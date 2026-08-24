import { NextResponse } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { parseHabitInput } from "@/lib/validation/habits";
import { parseTzOffset, requireUser } from "@/lib/server/api";
import { isHabitApplicableOnWeekday } from "@/types/domain";

export async function GET(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const tzOffset = parseTzOffset(searchParams.get("tzOffset"));

  // Mesma convenção de data do POST /[id]/complete: meia-noite UTC do dia
  // local do usuário. Semanal agrega a semana corrente (domingo início).
  const now = new Date();
  const userNow = new Date(now.getTime() - tzOffset * 60_000);
  const dayStartMs = Date.UTC(
    userNow.getUTCFullYear(),
    userNow.getUTCMonth(),
    userNow.getUTCDate(),
  );
  const weekStartMs = dayStartMs - userNow.getUTCDay() * 86_400_000;

  const [habits, completions] = await Promise.all([
    prisma.habit.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.habitCompletion.findMany({
      where: { userId: user.id, date: { gte: new Date(weekStartMs) } },
      select: { habitId: true, date: true, count: true },
    }),
  ]);

  return NextResponse.json(
    habits.map((habit) => {
      const isDaily = habit.frequency !== "weekly";
      let currentCount = 0;
      for (const completion of completions) {
        if (completion.habitId !== habit.id) continue;
        const completionMs = completion.date.getTime();
        if (
          isDaily
            ? completionMs === dayStartMs
            : completionMs >= weekStartMs && completionMs <= dayStartMs
        ) {
          currentCount += completion.count;
        }
      }
      return {
        ...habit,
        currentCount,
        isApplicableToday: isHabitApplicableOnWeekday(
          habit,
          userNow.getUTCDay(),
        ),
      };
    }),
  );
}

export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;

  const result = parseHabitInput(await request.json());

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const habit = await prisma.habit.create({
    data: {
      userId: user.id,
      ...result.data,
    },
  });

  return NextResponse.json({ ...habit, currentCount: 0 }, { status: 201 });
}
