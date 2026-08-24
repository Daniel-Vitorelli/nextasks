import { NextResponse } from "next/server";

import { prisma } from "@/lib/server/prisma";
import {
  badRequest,
  notFound,
  parseTzOffset,
  requireUser,
} from "@/lib/server/api";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function parseDaysOfWeek(value: string): number[] {
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
    }
  } catch {
    return [];
  }
  return [];
}

export async function POST(request: Request, { params }: RouteParams) {
  const { user, response } = await requireUser();
  if (response) return response;

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const tzOffset = parseTzOffset(searchParams.get("tzOffset"));

  const body = await request.json().catch(() => ({}));
  const increment =
    typeof body.increment === "number" &&
    Number.isFinite(body.increment) &&
    body.increment > 0
      ? Math.floor(body.increment)
      : 1;

  const habit = await prisma.habit.findFirst({
    where: { id, userId: user.id },
  });

  if (!habit) {
    return notFound();
  }

  // Data local do usuário como chave de dia (meia-noite UTC do dia local).
  const now = new Date();
  const userNow = new Date(now.getTime() - tzOffset * 60_000);
  const dayStartMs = Date.UTC(
    userNow.getUTCFullYear(),
    userNow.getUTCMonth(),
    userNow.getUTCDate(),
  );
  const date = new Date(dayStartMs);
  const weekStartMs = dayStartMs - userNow.getUTCDay() * 86_400_000;

  // Hábitos diários só aceitam marcação nos dias agendados; semanais podem
  // ser marcados em qualquer dia (a meta vale para a semana inteira).
  if (habit.frequency !== "weekly") {
    const daysOfWeek = parseDaysOfWeek(habit.daysOfWeek);
    if (!daysOfWeek.includes(userNow.getUTCDay())) {
      return badRequest("Habit not scheduled for today");
    }
  }

  const { completion, periodCount } = await prisma.$transaction(async (tx) => {
    let row = await tx.habitCompletion.upsert({
      where: {
        habitId_date: {
          habitId: habit.id,
          date,
        },
      },
      create: {
        habitId: habit.id,
        userId: user.id,
        date,
        count: increment,
      },
      update: {
        count: { increment },
      },
    });

    // Cliques repetidos não devem ultrapassar a meta.
    if (row.count > habit.targetCount) {
      row = await tx.habitCompletion.update({
        where: { id: row.id },
        data: { count: habit.targetCount },
      });
    }

    // Diário: conta só hoje; semanal: soma a semana corrente.
    const periodStart =
      habit.frequency === "weekly" ? new Date(weekStartMs) : date;
    const aggregated = await tx.habitCompletion.aggregate({
      _sum: { count: true },
      where: {
        habitId: habit.id,
        date: { gte: periodStart, lte: date },
      },
    });

    return { completion: row, periodCount: aggregated._sum.count ?? 0 };
  });

  return NextResponse.json({
    completion,
    isComplete: completion.count >= habit.targetCount,
    periodCount,
  });
}