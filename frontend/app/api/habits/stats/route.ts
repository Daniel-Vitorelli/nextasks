import { NextResponse } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { parseTzOffset, requireUser } from "@/lib/server/api";
import { buildHabitProgress } from "@/lib/habit-stats";
import { computeStreak } from "@/lib/streak";
import type { HabitStats } from "@/types/domain";

const ALLOWED_DAYS = [30, 90, 180, 365];
const DAY_MS = 86_400_000;

/**
 * Progresso diário e streak por hábito (ver lib/habit-stats.ts para as
 * regras de dias agendados e semanas).
 */
export async function GET(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;

  const url = new URL(request.url);
  const tzOffsetMinutes = parseTzOffset(url.searchParams.get("tzOffset"));

  const daysParam = Number.parseInt(url.searchParams.get("days") ?? "365", 10);
  const days = ALLOWED_DAYS.includes(daysParam) ? daysParam : 365;

  const now = new Date();
  const userNow = new Date(now.getTime() - tzOffsetMinutes * 60_000);
  const dayStartMs = Date.UTC(
    userNow.getUTCFullYear(),
    userNow.getUTCMonth(),
    userNow.getUTCDate(),
  );
  const windowStartMs = dayStartMs - (days - 1) * DAY_MS;
  // Semanas podem começar antes da janela: busca uma semana extra.
  const fetchStartMs = windowStartMs - 6 * DAY_MS;

  const [habits, completions] = await Promise.all([
    prisma.habit.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.habitCompletion.findMany({
      where: { userId: user.id, date: { gte: new Date(fetchStartMs) } },
      select: { habitId: true, date: true, count: true },
    }),
  ]);

  const countsByHabit = new Map<string, Map<number, number>>();
  for (const completion of completions) {
    let rows = countsByHabit.get(completion.habitId);
    if (!rows) {
      rows = new Map();
      countsByHabit.set(completion.habitId, rows);
    }
    rows.set(completion.date.getTime(), completion.count);
  }

  // Início do dia local de criação do hábito (chave de dia).
  const createdDayMs = (createdAt: Date) => {
    const local = new Date(createdAt.getTime() - tzOffsetMinutes * 60_000);
    return Date.UTC(
      local.getUTCFullYear(),
      local.getUTCMonth(),
      local.getUTCDate(),
    );
  };

  const stats: HabitStats[] = habits.map((habit) => {
    const progress = buildHabitProgress(
      {
        frequency: habit.frequency,
        daysOfWeek: habit.daysOfWeek,
        targetCount: habit.targetCount,
        createdAtDayMs: createdDayMs(habit.createdAt),
      },
      countsByHabit.get(habit.id) ?? new Map<number, number>(),
      { dayStartMs, windowStartMs },
    );

    return {
      habitId: habit.id,
      progress,
      streak: computeStreak(progress, new Date(dayStartMs)),
    };
  });

  return NextResponse.json({ habits: stats });
}
