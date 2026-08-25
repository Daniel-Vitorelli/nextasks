import type { Prisma } from "@/generated/prisma/client";
import { levelFromXp } from "@/lib/gamification/levels";
import { streakSummary } from "@/lib/gamification/streaks";

type Db = Prisma.TransactionClient;

const DAY_MS = 86_400_000;

/** Chave de dia local (ms) para um instante UTC no fuso do usuário. */
function dayKeyMs(instantUtc: Date, tzOffsetMinutes: number): number {
  const local = new Date(instantUtc.getTime() - tzOffsetMinutes * 60_000);
  return Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate(),
  );
}

/** Um valor de confirmação de bloco conta como feito? */
function blockValueCounts(mode: string, value: string): boolean {
  if (mode === "checklist") return value === "true";
  if (mode === "score") {
    const score = Number.parseInt(value, 10);
    return !Number.isNaN(score) && score >= 1;
  }
  return false;
}

/**
 * Snapshot de estatísticas que alimenta conquistas e a página de
 * gamificação. Todas as consultas são limitadas ao usuário; as varreduras
 * por dia são limitadas à criação das entidades.
 */
export async function loadGamificationStats(
  db: Db,
  userId: string,
  tzOffsetMinutes: number,
) {
  const now = new Date();
  const userNow = new Date(now.getTime() - tzOffsetMinutes * 60_000);
  const dayStartMs = Date.UTC(
    userNow.getUTCFullYear(),
    userNow.getUTCMonth(),
    userNow.getUTCDate(),
  );

  const [aggregates, habits, habitCompletions, blockCompletions, connections, activeRoutine] =
    await Promise.all([
      db.xpEvent.aggregate({ where: { userId }, _sum: { amount: true } }),
      db.habit.findMany({ where: { userId } }),
      db.habitCompletion.findMany({
        where: { userId },
        select: { habitId: true, date: true, count: true },
      }),
      db.timeBlockCompletion.findMany({
        where: { userId },
        select: {
          periodStart: true,
          value: true,
          timeBlockId: true,
          timeBlock: {
            select: { confirmation: true },
          },
        },
      }),
      db.taskBlockConnection.findMany({
        where: { userId },
        select: { id: true },
      }),
      db.routine.findFirst({
        where: { userId, isActive: true },
        include: {
          timeBlocks: {
            where: { confirmation: { not: "none" } },
            select: { id: true, start: true },
          },
        },
      }),
    ]);

  const totalXp = aggregates._sum.amount ?? 0;
  const level = levelFromXp(totalXp);

  const blocksConfirmed = blockCompletions.filter((completion) =>
    blockValueCounts(
      completion.timeBlock.confirmation,
      completion.value,
    ),
  ).length;

  const perfect10 = blockCompletions.filter(
    (completion) => completion.value === "10",
  ).length;

  // Dia/semana 100% e melhor streak da rotina ativa: um período é completo
  // quando o número de blocos DISTINTOS com confirmação válida cobre todos
  // os blocos confirmáveis. Diário: unidade = dia; semanal: unidade = semana
  // (streak conta semanas cheias consecutivas).
  let days100 = 0;
  let bestRoutineStreak = 0;
  let currentRoutineStreak = 0;
  if (activeRoutine && activeRoutine.timeBlocks.length > 0) {
    const isWeekly = activeRoutine.frequency === "weekly";
    const unitMs = isWeekly ? 7 * DAY_MS : DAY_MS;
    const createdUnit = Math.floor(
      dayKeyMs(activeRoutine.createdAt, tzOffsetMinutes) / unitMs,
    );

    const validByPeriod = new Map<number, Set<string>>();
    for (const completion of blockCompletions) {
      if (
        !blockValueCounts(
          completion.timeBlock.confirmation,
          completion.value,
        )
      ) {
        continue;
      }
      const key = completion.periodStart.getTime();
      const set = validByPeriod.get(key) ?? new Set<string>();
      set.add(completion.timeBlockId);
      validByPeriod.set(key, set);
    }

    const fullUnits: number[] = [];
    for (const [periodMs, valid] of validByPeriod) {
      if (valid.size < activeRoutine.timeBlocks.length) continue;
      const unit = Math.floor(periodMs / unitMs);
      if (unit >= createdUnit) fullUnits.push(unit);
    }

    days100 = fullUnits.length;

    const sorted = [...new Set(fullUnits)].sort((a, b) => a - b);
    const routineSummary = streakSummary(
      sorted,
      Math.floor(dayStartMs / unitMs),
    );
    bestRoutineStreak = routineSummary.best;
    currentRoutineStreak = routineSummary.current;
  }

  const [tasksDone, subtasksDone] = await Promise.all([
    db.task.count({ where: { userId, done: true } }),
    db.subtask.count({ where: { task: { userId }, done: true } }),
  ]);

  const goodHabitsActive = habits.filter(
    (habit) => habit.type === "good",
  ).length;
  const badHabitsActive = habits.filter(
    (habit) => habit.type === "bad",
  ).length;

  // Hábitos: metas batidas (count >= target), recaídas e melhor streak
  // LIMPO — apenas hábitos ruins participam (ausência de marcação = dia limpo
  // desde a criação do hábito).
  const habitsById = new Map(habits.map((habit) => [habit.id, habit]));
  let habitTargetDays = 0;
  let relapsesLogged = 0;
  const cleanDaysByHabit = new Map<string, Set<number>>();

  for (const habit of habits) {
    if (habit.type !== "bad") continue;
    const days = new Set<number>();
    const createdMs = dayKeyMs(habit.createdAt, tzOffsetMinutes);
    for (let ms = createdMs; ms <= dayStartMs; ms += DAY_MS) {
      days.add(ms / DAY_MS);
    }
    cleanDaysByHabit.set(habit.id, days);
  }

  for (const completion of habitCompletions) {
    const habit = habitsById.get(completion.habitId);
    if (!habit) continue;
    if (habit.type === "bad") {
      relapsesLogged += 1;
      cleanDaysByHabit.get(completion.habitId)?.delete(
        completion.date.getTime() / DAY_MS,
      );
    } else if (completion.count >= habit.targetCount) {
      habitTargetDays += 1;
    }
  }

  let bestCleanStreak = 0;
  let currentCleanStreak = 0;
  for (const [, days] of cleanDaysByHabit) {
    const sorted = [...days].sort((a, b) => a - b);
    const summary = streakSummary(sorted, dayStartMs / DAY_MS);
    if (summary.best > bestCleanStreak) bestCleanStreak = summary.best;
    if (summary.current > currentCleanStreak) {
      currentCleanStreak = summary.current;
    }
  }

  return {
    totalXp,
    level,
    blocksConfirmed,
    perfect10,
    days100,
    bestRoutineStreak,
    currentRoutineStreak,
    tasksDone,
    subtasksDone,
    activeConnections: connections.length,
    goodHabitsActive,
    badHabitsActive,
    habitTargetDays,
    relapsesLogged,
    bestCleanStreak,
    currentCleanStreak,
  };
}

export type GamificationStatsSnapshot = Awaited<
  ReturnType<typeof loadGamificationStats>
>;
