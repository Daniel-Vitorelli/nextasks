import { prisma } from "@/lib/server/prisma";
import {
  localWeekday,
  periodForFrequency,
  startOfDayUtc,
  startOfWeekUtc,
} from "@/lib/server/completions";
import { materializeSchedule } from "@/lib/server/schedule";
import { loadGamificationStats } from "@/lib/server/gamification/stats";
import { sortPendingTasks } from "@/lib/task-ordering";
import type { MemoryFact } from "@/generated/prisma/client";
import type { TaskPriority } from "@/types/domain";

const DAY_MS = 86_400_000;

/* ------------------------- Dados estruturados ------------------------- */

export interface AiRoutineDay {
  routineName: string | null;
  blocks: { title: string; time: string; confirmed: boolean }[];
}

export interface AiContextData {
  userName: string;
  locale: "pt" | "en";
  today: string; // YYYY-MM-DD local
  weekday: string;
  pendingTasks: { title: string; priority: number; dueDate: string | null }[];
  upcomingTasks: { title: string; dueDate: string }[];
  habitsToday: { name: string; type: string; count: number; targetCount: number }[];
  routineDay: AiRoutineDay | null;
  stats: {
    totalXp: number;
    level: number;
    currentRoutineStreak: number;
    bestCleanStreak: number;
    tasksDone: number;
    blocksConfirmed: number;
  };
  memoryFacts: string[];
}

/* ------------------------------ Formatação ----------------------------- */

/** Dia/semana de blocos em texto curto ("08:00"). */
function hhmm(isoOrDate: Date): string {
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(
    date.getUTCMinutes(),
  ).padStart(2, "0")}`;
}

/**
 * Monta o system prompt a partir dos dados estruturados. Função PURA —
 * testável sem banco. O idioma do prompt segue o locale do usuário.
 */
export function buildSystemPrompt(data: AiContextData): string {
  const pt = data.locale === "pt";

  const lines: string[] = [
    pt
      ? `Você é o assistente pessoal do NexTasks, um app de rotinas, hábitos e tarefas. Você ACONSELHA — não executa ações. Responda SEMPRE no idioma ${pt ? "português" : "inglês"}, de forma concisa, prática e motivadora.`
      : `You are the NexTasks personal assistant, an app for routines, habits and tasks. You ADVISE — you cannot execute actions. Always answer in English, concisely, practically and motivating.`,
  ];

  if (data.memoryFacts.length > 0) {
    lines.push(
      pt
        ? `\n## O que você lembra sobre o usuário\n${data.memoryFacts.map((fact) => `- ${fact}`).join("\n")}`
        : `\n## What you remember about the user\n${data.memoryFacts.map((fact) => `- ${fact}`).join("\n")}`,
    );
  }

  lines.push(
    pt
      ? `\n## Contexto de hoje (${data.today}, ${data.weekday})\nUsuário: ${data.userName}`
      : `\n## Today's context (${data.today}, ${data.weekday})\nUser: ${data.userName}`,
  );

  // Rotina do dia
  if (data.routineDay && data.routineDay.blocks.length > 0) {
    const done = data.routineDay.blocks.filter((block) => block.confirmed).length;
    lines.push(
      pt
        ? `\n### Rotina "${data.routineDay.routineName}" — ${done}/${data.routineDay.blocks.length} blocos confirmados hoje`
        : `\n### Routine "${data.routineDay.routineName}" — ${done}/${data.routineDay.blocks.length} blocks confirmed today`,
    );
    for (const block of data.routineDay.blocks) {
      const mark = block.confirmed ? "[x]" : "[ ]";
      lines.push(`- ${mark} ${block.time} ${block.title}`);
    }
  }

  // Tarefas pendentes (ordenadas por urgência)
  if (data.pendingTasks.length > 0) {
    lines.push(pt ? "\n### Tarefas pendentes (por prioridade)" : "\n### Pending tasks (by priority)");
    for (const task of data.pendingTasks) {
      const due = task.dueDate
        ? pt
          ? ` (vence ${task.dueDate})`
          : ` (due ${task.dueDate})`
        : "";
      lines.push(`- ${task.title} [p${task.priority}]${due}`);
    }
  }

  // Vencimentos próximos
  if (data.upcomingTasks.length > 0) {
    lines.push(pt ? "\n### Vencendo nos próximos 7 dias" : "\n### Due within 7 days");
    for (const task of data.upcomingTasks) {
      lines.push(`- ${task.title}: ${task.dueDate}`);
    }
  }

  // Hábitos de hoje
  if (data.habitsToday.length > 0) {
    lines.push(pt ? "\n### Hábitos de hoje" : "\n### Today's habits");
    for (const habit of data.habitsToday) {
      const kind =
        habit.type === "bad"
          ? pt
            ? "ruim"
            : "bad"
          : pt
            ? "bom"
            : "good";
      lines.push(`- ${habit.name} (${kind}): ${habit.count}/${habit.targetCount}`);
    }
  }

  // Gamificação
  lines.push(
    pt
      ? `\n### Gamificação\nXP total: ${data.stats.totalXp} · Nível: ${data.stats.level} · Streak da rotina: ${data.stats.currentRoutineStreak} · Melhor sequência limpa: ${data.stats.bestCleanStreak} · Tarefas concluídas: ${data.stats.tasksDone} · Blocos confirmados: ${data.stats.blocksConfirmed}`
      : `\n### Gamification\nTotal XP: ${data.stats.totalXp} · Level: ${data.stats.level} · Routine streak: ${data.stats.currentRoutineStreak} · Best clean streak: ${data.stats.bestCleanStreak} · Tasks done: ${data.stats.tasksDone} · Blocks confirmed: ${data.stats.blocksConfirmed}`,
  );

  lines.push(
    pt
      ? "\nUse esses dados para dar conselhos concretos sobre rotina, hábitos e tarefas. Não invente dados que não estão aqui."
      : "\nUse this data to give concrete advice about routines, habits and tasks. Do not invent data that is not here.",
  );

  return lines.join("\n");
}

/* ----------------------------- Carregamento ---------------------------- */

function weekdayName(weekday: number, pt: boolean): string {
  const names = pt
    ? ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"]
    : ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return names[weekday] ?? "";
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Coleta todos os dados do usuário para o prompt. Lê direto do Prisma
 * (sem chamadas HTTP internas). O locale vem da request do cliente.
 */
export async function loadAiContextData(
  userId: string,
  locale: "pt" | "en" = "pt",
): Promise<AiContextData> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, timezoneOffset: true },
  });

  const tzOffsetMinutes = user?.timezoneOffset ?? 0;
  const now = new Date();
  const userNow = new Date(now.getTime() - tzOffsetMinutes * 60_000);
  const dayStartMs = startOfDayUtc(now, tzOffsetMinutes).getTime();
  const dayStart = new Date(dayStartMs);
  const weekday = userNow.getUTCDay();
  const pt = locale === "pt";

  /* Tarefas pendentes + próximas 7 dias */
  const tasks = await prisma.task.findMany({
    where: { userId },
    select: { title: true, priority: true, dueDate: true, done: true, createdAt: true },
  });
  // Converte para o formato de datas-string do domínio antes de ordenar.
  const pending = sortPendingTasks(
    tasks
      .filter((task) => !task.done)
      .map((task) => ({
        title: task.title,
        priority: task.priority as TaskPriority,
        dueDate: task.dueDate?.toISOString() ?? null,
        createdAt: task.createdAt.toISOString(),
      })),
    now,
  ).slice(0, 10);
  const upcoming = tasks
    .filter(
      (task) =>
        !task.done &&
        task.dueDate !== null &&
        task.dueDate.getTime() >= dayStartMs &&
        task.dueDate.getTime() < dayStartMs + 7 * DAY_MS,
    )
    .sort((a, b) => (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0))
    .slice(0, 10);

  /* Hábitos aplicáveis hoje com progresso do período */
  const habits = await prisma.habit.findMany({
    where: { userId },
    select: { id: true, name: true, type: true, frequency: true, daysOfWeek: true, targetCount: true },
  });
  const weekStartMs = startOfWeekUtc(now, tzOffsetMinutes).getTime();
  let habitCompletions: { habitId: string; date: Date; count: number }[] = [];
  if (habits.length > 0) {
    habitCompletions = await prisma.habitCompletion.findMany({
      where: {
        userId,
        habitId: { in: habits.map((habit) => habit.id) },
        date: { gte: new Date(Math.min(dayStartMs, weekStartMs)) },
      },
      select: { habitId: true, date: true, count: true },
    });
  }
  const parseDays = (value: string): number[] => {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(Number).filter(Number.isInteger) : [];
    } catch {
      return [];
    }
  };
  const habitsToday = habits
    .filter((habit) => {
      if (habit.type === "bad") return true; // ruins são rastreados todo dia
      return (
        habit.frequency === "weekly" ||
        parseDays(habit.daysOfWeek).includes(localWeekday(now, tzOffsetMinutes))
      );
    })
    .map((habit) => {
      const relevant = habitCompletions.filter((row) => row.habitId === habit.id);
      let count: number;
      if (habit.type === "bad") {
        count = relevant.filter((row) => row.date.getTime() === dayStartMs).length;
      } else if (habit.frequency === "weekly") {
        count = relevant
          .filter((row) => row.date.getTime() >= weekStartMs)
          .reduce((sum, row) => sum + row.count, 0);
      } else {
        count = relevant.filter((row) => row.date.getTime() === dayStartMs).reduce(
          (sum, row) => sum + row.count,
          0,
        );
      }
      return {
        name: habit.name,
        type: habit.type,
        count,
        targetCount: habit.type === "bad" ? 0 : habit.targetCount,
      };
    })
    .slice(0, 15);

  /* Rotina ativa: blocos de hoje com status de confirmação */
  const occurrences = await materializeSchedule(
    userId,
    dayStart,
    new Date(dayStartMs + DAY_MS - 1),
    tzOffsetMinutes,
  );
  const confirmable = occurrences.filter((occurrence) => occurrence.confirmation !== "none");
  let routineDay: AiRoutineDay | null = null;
  if (confirmable.length > 0) {
    const routine = await prisma.routine.findFirst({
      where: { id: confirmable[0].routineId, isActive: true },
      select: { frequency: true, name: true },
    });
    const period = routine
      ? periodForFrequency(routine.frequency === "weekly" ? "weekly" : "daily", now, tzOffsetMinutes)
      : null;
    const completions = period
      ? await prisma.timeBlockCompletion.findMany({
          where: {
            userId,
            timeBlockId: { in: confirmable.map((occurrence) => occurrence.blockId) },
            periodStart: period.start,
          },
          select: { timeBlockId: true, value: true, timeBlock: { select: { confirmation: true } } },
        })
      : [];
    const validByBlock = new Set(
      completions
        .filter((completion) => {
          const mode = completion.timeBlock.confirmation;
          return mode === "checklist"
            ? completion.value === "true"
            : Number.parseInt(completion.value, 10) >= 1;
        })
        .map((completion) => completion.timeBlockId),
    );
    routineDay = {
      routineName: routine?.name ?? null,
      blocks: confirmable.slice(0, 20).map((occurrence) => ({
        title: occurrence.title,
        time: `${hhmm(new Date(occurrence.start))}–${hhmm(new Date(occurrence.end))}`,
        confirmed: validByBlock.has(occurrence.blockId),
      })),
    };
  }

  /* Gamificação + memória */
  const [statsSnapshot, facts] = await Promise.all([
    loadGamificationStats(prisma, userId, tzOffsetMinutes),
    prisma.memoryFact.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 30,
      select: { fact: true },
    }),
  ]);

  return {
    userName: user?.name ?? (pt ? "usuário" : "user"),
    locale,
    today: isoDay(userNow),
    weekday: weekdayName(weekday, locale === "pt"),
    pendingTasks: pending.map((task) => ({
      title: task.title,
      priority: task.priority,
      dueDate: task.dueDate ? task.dueDate.slice(0, 10) : null,
    })),
    upcomingTasks: upcoming
      .map((task) => ({
        title: task.title,
        dueDate: task.dueDate ? isoDay(task.dueDate) : "",
      }))
      .filter((task) => task.dueDate !== ""),
    habitsToday,
    routineDay,
    stats: {
      totalXp: statsSnapshot.totalXp,
      level: statsSnapshot.level,
      currentRoutineStreak: statsSnapshot.currentRoutineStreak,
      bestCleanStreak: statsSnapshot.bestCleanStreak,
      tasksDone: statsSnapshot.tasksDone,
      blocksConfirmed: statsSnapshot.blocksConfirmed,
    },
    memoryFacts: facts.map((fact: Pick<MemoryFact, "fact">) => fact.fact),
  };
}
