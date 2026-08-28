import { prisma } from "@/lib/server/prisma";
import { periodForFrequency } from "@/lib/server/completions";
import { materializeSchedule } from "@/lib/server/schedule";
import { notifyUser } from "@/lib/server/push";
import type { NotificationKind } from "@/lib/notifications/templates";
import {
  CHALLENGE_WIN_XP,
  computeMetricValue,
  resolveWinner,
} from "@/lib/server/challenges";
import { notifyChallengeFinished } from "@/lib/server/push";
import { awardXpOnce } from "@/lib/server/gamification/xp";
import { recordActivity } from "@/lib/server/activity";

const DAY_MS = 86_400_000;

/** daysOfWeek é armazenado como array JSON de 0–6. */
function parseDaysOfWeek(value: string): number[] {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(Number)
      .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
  } catch {
    return [];
  }
}

const BLOCK_REMINDER_MINUTES = Number.parseInt(
  process.env.BLOCK_REMINDER_MINUTES ?? "15",
  10,
);
const EOD_NUDGE_MINUTES = Number.parseInt(
  process.env.EOD_NUDGE_MINUTES ?? "60",
  10,
);

/** Um valor de confirmação de bloco conta como confirmado? */
function blockValueCounts(mode: string, value: string): boolean {
  if (mode === "checklist") return value === "true";
  if (mode === "score") {
    const score = Number.parseInt(value, 10);
    return !Number.isNaN(score) && score >= 1;
  }
  return false;
}

export interface ReminderCandidate {
  kind: NotificationKind;
  refKey: string;
  params?: Record<string, string | number>;
}

/**
 * Tarefas que vencem hoje ou que ficaram atrasadas desde ontem (janela de
 * um dia — sem nag diário). `tasks` já vem filtradas para done=false com
 * dueDate entre [ontem 00:00, amanhã 00:00) do fuso do usuário.
 */
export function computeTaskReminders(
  tasks: { id: string; title: string; dueDate: Date | null }[],
  dayStartMs: number,
): ReminderCandidate[] {
  const candidates: ReminderCandidate[] = [];
  for (const task of tasks) {
    if (!task.dueDate) continue;
    const dueMs = task.dueDate.getTime();
    if (dueMs >= dayStartMs && dueMs < dayStartMs + DAY_MS) {
      candidates.push({
        kind: "task.due.today",
        refKey: `task:${task.id}:${dayStartMs}`,
        params: { title: task.title },
      });
    } else if (dueMs >= dayStartMs - DAY_MS && dueMs < dayStartMs) {
      // Ficou atrasada agora (vencia ontem): avisa uma única vez.
      candidates.push({
        kind: "task.overdue",
        refKey: `task:${task.id}:overdue:${dayStartMs}`,
        params: { title: task.title },
      });
    }
  }
  return candidates;
}

/** Minutos restantes até o início (mesmo dia local); null se fora do horizonte. */
export function minutesUntilBlock(
  startInstantMs: number,
  nowMs: number,
  horizonMinutes: number,
): number | null {
  const diffMinutes = Math.round((startInstantMs - nowMs) / 60_000);
  if (diffMinutes > 0 && diffMinutes <= horizonMinutes) return diffMinutes;
  return null;
}

/** O minuto local atual está na janela do nudge de fim de dia? */
export function isEndOfDayWindow(localMinuteOfDay: number): boolean {
  return localMinuteOfDay === 24 * 60 - EOD_NUDGE_MINUTES;
}

/**
 * Varredura de lembretes. Chamada por instrumentation.ts a cada minuto;
 * o dedup em NotificationLog garante no máximo uma push por candidato.
 */
export async function runReminderSweep(db: typeof prisma = prisma, now = new Date()): Promise<void> {
  const subscribed = await db.pushSubscription.findMany({
    distinct: ["userId"],
    select: { userId: true },
  });
  for (const { userId } of subscribed) {
    await remindUser(db, userId, now).catch((error) => {
      console.warn(`[reminders] failed for user ${userId}:`, error);
    });
  }

  // Desafios expirados: finaliza mesmo sem subscription (resultado é conteúdo).
  await finalizeExpiredChallenges(db, now).catch((error) => {
    console.warn("[reminders] challenge finalization failed:", error);
  });
}

/**
 * Finaliza desafios ativos cujo endsAt passou: calcula métricas dos dois
 * lados, determina vencedor, credita +CHALLENGE_WIN_XP idempotente e
 * notifica/participa no feed. Idempotente — só toca em status "active".
 */
export async function finalizeExpiredChallenges(
  db: typeof prisma,
  now = new Date(),
): Promise<void> {
  const expired = await db.challenge.findMany({
    where: { status: "active", endsAt: { lte: now } },
    take: 20,
  });

  for (const challenge of expired) {
    const [challenger, challenged] = await Promise.all([
      db.user.findUnique({
        where: { id: challenge.challengerId },
        select: { name: true },
      }),
      db.user.findUnique({
        where: { id: challenge.challengedId },
        select: { name: true },
      }),
    ]);
    if (!challenger || !challenged) continue;

    // Transação: revalida status, resolve vencedor e credita o bônus.
    // undefined = transação falhou; null = empate; string = vencedor.
    let winnerId: string | null | undefined;
    await db
      .$transaction(async (tx) => {
        const current = await tx.challenge.findUnique({
          where: { id: challenge.id },
          select: { status: true, startedAt: true, endsAt: true },
        });
        if (!current || current.status !== "active") {
          winnerId = null;
          return;
        }

        const window = {
          start: current.startedAt ?? challenge.createdAt,
          end: current.endsAt ?? now,
        };
        const [challengerValue, challengedValue] = await Promise.all([
          computeMetricValue(tx, challenge.challengerId, challenge.metric, window),
          computeMetricValue(tx, challenge.challengedId, challenge.metric, window),
        ]);
        const resolved = resolveWinner(
          challenge.challengerId,
          challenge.challengedId,
          challengerValue,
          challengedValue,
        );

        if (resolved) {
          await awardXpOnce(
            tx,
            resolved,
            "challenge.win",
            CHALLENGE_WIN_XP,
            `challenge:${challenge.id}:win`,
          );
        }

        await tx.challenge.update({
          where: { id: challenge.id },
          data: { status: "finished", winnerId: resolved },
        });
        winnerId = resolved ?? null;
      })
      .catch((error) => {
        console.warn(`[reminders] finalize challenge ${challenge.id} failed:`, error);
        winnerId = null;
      });

    if (winnerId === undefined) continue; // transação falhou de verdade

    const resolvedWinnerId = winnerId;

    // Feed de atividade para os dois lados (com os nomes dos participantes).
    const winnerName =
      resolvedWinnerId === challenge.challengerId
        ? challenger.name
        : resolvedWinnerId === challenge.challengedId
          ? challenged.name
          : "";
    await Promise.all([
      recordActivity(challenge.challengerId, "challenge.finished", {
        metric: challenge.metric,
        target: challenge.target,
        winnerName,
        challengerName: challenger.name,
        challengedName: challenged.name,
      }),
      recordActivity(challenge.challengedId, "challenge.finished", {
        metric: challenge.metric,
        target: challenge.target,
        winnerName,
        challengerName: challenger.name,
        challengedName: challenged.name,
      }),
    ]);

    await notifyChallengeFinished({
      participantIds: [challenge.challengerId, challenge.challengedId],
      names: { challenger: challenger.name, challenged: challenged.name },
      winnerId: resolvedWinnerId,
      challengeId: challenge.id,
    });
  }
}

async function remindUser(
  db: typeof prisma,
  userId: string,
  now: Date,
): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { timezoneOffset: true },
  });

  const tzOffsetMinutes = user?.timezoneOffset ?? 0;
  const userNow = new Date(now.getTime() - tzOffsetMinutes * 60_000);
  const dayStartMs = Date.UTC(
    userNow.getUTCFullYear(),
    userNow.getUTCMonth(),
    userNow.getUTCDate(),
  );
  const dayStart = new Date(dayStartMs);
  const dayEnd = new Date(dayStartMs + DAY_MS);

  /* ------------------------- Tarefas ------------------------- */
  const openTasks = await db.task.findMany({
    where: {
      userId,
      done: false,
      dueDate: { gte: new Date(dayStartMs - DAY_MS), lt: dayEnd },
    },
    select: { id: true, title: true, dueDate: true },
  });
  for (const candidate of computeTaskReminders(openTasks, dayStartMs)) {
    await notifyUser(userId, candidate.kind, candidate.refKey, candidate.params, "/app/home");
  }

  /* --------------------- Blocos da rotina -------------------- */
  // Ocorrências de hoje (materializa recorrência + filtro de dia/semana).
  const occurrences = await materializeSchedule(userId, dayStart, dayEnd, tzOffsetMinutes);

  // Bloco começando em ~N minutos e ainda não confirmado.
  const startingSoon = occurrences
    .filter((occurrence) => occurrence.confirmation !== "none" && !occurrence.isAllDay)
    .map((occurrence) => ({
      occurrence,
      minutes: minutesUntilBlock(Date.parse(occurrence.start), now.getTime(), BLOCK_REMINDER_MINUTES),
    }))
    .filter((entry): entry is { occurrence: typeof occurrences[number]; minutes: number } =>
      entry.minutes !== null,
    );

  if (startingSoon.length > 0) {
    const routineId = startingSoon[0].occurrence.routineId;
    const routine = await db.routine.findFirst({
      where: { id: routineId, isActive: true },
      select: { frequency: true },
    });
    const period = routine
      ? periodForFrequency(routine.frequency === "weekly" ? "weekly" : "daily", now, tzOffsetMinutes)
      : null;

    let confirmedBlockIds = new Set<string>();
    if (period) {
      const completions = await db.timeBlockCompletion.findMany({
        where: {
          userId,
          timeBlockId: {
            in: startingSoon.map((entry) => entry.occurrence.blockId),
          },
          periodStart: period.start,
        },
        select: { timeBlockId: true, value: true, timeBlock: { select: { confirmation: true } } },
      });
      confirmedBlockIds = new Set(
        completions
          .filter((completion) =>
            blockValueCounts(completion.timeBlock.confirmation, completion.value),
          )
          .map((completion) => completion.timeBlockId),
      );
    }

    for (const entry of startingSoon) {
      if (confirmedBlockIds.has(entry.occurrence.blockId)) continue;
      await notifyUser(
        userId,
        "block.starting",
        `block:${entry.occurrence.blockId}:${dayStartMs}`,
        { title: entry.occurrence.title, minutes: entry.minutes },
        "/app/home",
      );
    }
  }

  /* --------------- Nudges de fim do dia local ---------------- */
  const localMinuteOfDay =
    userNow.getUTCHours() * 60 + userNow.getUTCMinutes();
  if (!isEndOfDayWindow(localMinuteOfDay)) return;

  const confirmableToday = occurrences.filter(
    (occurrence) => occurrence.confirmation !== "none",
  );
  if (confirmableToday.length > 0) {
    const routineId = confirmableToday[0].routineId;
    const routine = await db.routine.findFirst({
      where: { id: routineId, isActive: true },
      select: { frequency: true },
    });
    const period = routine
      ? periodForFrequency(routine.frequency === "weekly" ? "weekly" : "daily", now, tzOffsetMinutes)
      : null;

    if (period) {
      const completions = await db.timeBlockCompletion.findMany({
        where: {
          userId,
          timeBlockId: { in: confirmableToday.map((o) => o.blockId) },
          periodStart: period.start,
        },
        select: { timeBlockId: true, value: true, timeBlock: { select: { confirmation: true } } },
      });
      const confirmedIds = new Set(
        completions
          .filter((completion) =>
            blockValueCounts(completion.timeBlock.confirmation, completion.value),
          )
          .map((completion) => completion.timeBlockId),
      );
      const remaining = confirmableToday.filter((o) => !confirmedIds.has(o.blockId)).length;
      if (remaining > 0) {
        await notifyUser(
          userId,
          "routine.day.incomplete",
          `routine:${dayStartMs}`,
          { remaining },
          "/app/home",
        );
      }
    }
  }

  // Hábitos bons aplicáveis hoje ainda abaixo da meta.
  const habits = await db.habit.findMany({
    where: { userId, type: "good" },
    select: { id: true, frequency: true, daysOfWeek: true, targetCount: true },
  });
  if (habits.length > 0) {
    const weekday = userNow.getUTCDay();
    const weekStartMs = dayStartMs - weekday * DAY_MS;
    const applicableDailyIds: string[] = [];
    const weeklyHabitIds: string[] = [];
    for (const habit of habits) {
      if (habit.frequency === "weekly") {
        // Semanal vale a semana inteira.
        weeklyHabitIds.push(habit.id);
      } else if (parseDaysOfWeek(habit.daysOfWeek).includes(weekday)) {
        applicableDailyIds.push(habit.id);
      }
    }

    let belowTarget = 0;
    if (applicableDailyIds.length > 0) {
      const todayCompletions = await db.habitCompletion.findMany({
        where: {
          userId,
          habitId: { in: applicableDailyIds },
          date: dayStart,
        },
        select: { habitId: true, count: true },
      });
      const countsByHabit = new Map(todayCompletions.map((row) => [row.habitId, row.count]));
      for (const habit of habits) {
        if (!applicableDailyIds.includes(habit.id)) continue;
        if ((countsByHabit.get(habit.id) ?? 0) < habit.targetCount) belowTarget += 1;
      }
    }

    if (weeklyHabitIds.length > 0) {
      // Semanal: meta comparada contra a SOMA dos dias da semana corrente.
      const weekCompletions = await db.habitCompletion.groupBy({
        by: ["habitId"],
        where: {
          userId,
          habitId: { in: weeklyHabitIds },
          date: { gte: new Date(weekStartMs), lte: dayStart },
        },
        _sum: { count: true },
      });
      const weekSums = new Map(
        weekCompletions.map((row) => [row.habitId, row._sum.count ?? 0]),
      );
      for (const habit of habits) {
        if (!weeklyHabitIds.includes(habit.id)) continue;
        if ((weekSums.get(habit.id) ?? 0) < habit.targetCount) belowTarget += 1;
      }
    }

    if (belowTarget > 0) {
      await notifyUser(
        userId,
        "habit.streak.atRisk",
        `habits:${dayStartMs}`,
        { count: belowTarget },
        "/app/home",
      );
    }
  }
}
