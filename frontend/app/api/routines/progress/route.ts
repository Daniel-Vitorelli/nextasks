import { NextResponse } from "next/server";

import { prisma } from "@/lib/server/prisma";
import {
  localWeekday,
  periodForFrequency,
  startOfDayUtc,
} from "@/lib/server/completions";
import { asFrequency, parseTzOffset, requireUser } from "@/lib/server/api";
import { computeStreak } from "@/lib/streak";
import type { DailyProgress, StreakStats } from "@/types/domain";

const ALLOWED_DAYS = [7, 15, 30, 60, 365];
const DAY_MS = 86_400_000;

export async function GET(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;

  const url = new URL(request.url);
  const tzOffsetMinutes = parseTzOffset(url.searchParams.get("tzOffset"));

  const daysParam = Number.parseInt(url.searchParams.get("days") ?? "30", 10);
  const days = ALLOWED_DAYS.includes(daysParam) ? daysParam : 30;

  const routine = await prisma.routine.findFirst({
    where: { userId: user.id, isActive: true },
  });

  if (!routine) {
    return NextResponse.json({
      routine: null,
      progress: [],
      streak: { current: 0, longest: 0, lastFullDay: null } satisfies StreakStats,
      period: null,
      daysWithRecords: 0,
    });
  }

  const frequency = asFrequency(routine.frequency);

  const timeBlocks = await prisma.timeBlock.findMany({
    where: { routineId: routine.id },
    orderBy: { start: "asc" },
  });

  // Sem blocos confirmaveis na rotina, o grafico nao faz sentido.
  const confirmableBlockCount = timeBlocks.filter(
    (block) => block.confirmation !== "none",
  ).length;

  const today = startOfDayUtc(new Date(), tzOffsetMinutes);
  const todayMs = today.getTime();

  // Dias com registro desde a criação da rotina: quantos dias no passado têm
  // ao menos um bloco confirmável aplicável (dias que aparecem no gráfico).
  // Passos fixos de 24h evitam artefatos de DST do fuso do servidor.
  let daysWithRecords = 0;
  for (
    let dayMs = startOfDayUtc(routine.createdAt, tzOffsetMinutes).getTime();
    dayMs <= todayMs;
    dayMs += DAY_MS
  ) {
    const weekday = localWeekday(new Date(dayMs), tzOffsetMinutes);
    const hasConfirmable = timeBlocks.some(
      (block) =>
        block.confirmation !== "none" &&
        (frequency === "daily" ||
          localWeekday(block.start, tzOffsetMinutes) === weekday),
    );
    if (hasConfirmable) daysWithRecords += 1;
  }

  const periodStart = new Date(today.getTime() - (days - 1) * DAY_MS);
  // A rotina começa a valer na data de criação: nada antes dela aparece.
  const start =
    routine.createdAt.getTime() > periodStart.getTime()
      ? startOfDayUtc(routine.createdAt, tzOffsetMinutes)
      : periodStart;
  const startMs = start.getTime();

  // Periodos distintos (dias ou semanas, conforme a frequencia) do intervalo.
  const periodStarts = new Set<number>();
  for (let dayMs = startMs; dayMs <= todayMs; dayMs += DAY_MS) {
    periodStarts.add(
      periodForFrequency(frequency, new Date(dayMs), tzOffsetMinutes).start.getTime(),
    );
  }

  const completions = await prisma.timeBlockCompletion.findMany({
    where: {
      userId: user.id,
      timeBlockId: { in: timeBlocks.map((block) => block.id) },
      periodStart: { in: [...periodStarts].map((time) => new Date(time)) },
    },
  });

  const completionsByKey = new Map(
    completions.map((completion) => [
      `${completion.timeBlockId}:${completion.periodStart.getTime()}`,
      completion,
    ]),
  );

  const progress: DailyProgress[] = [];

  for (let dayMs = startMs; dayMs <= todayMs; dayMs += DAY_MS) {
    const dayStart = new Date(dayMs);
    const weekday = localWeekday(dayStart, tzOffsetMinutes);

    // Rotina diaria vale todos os dias; semanal so no dia da semana do bloco.
    const applicableBlocks = timeBlocks.filter(
      (block) =>
        frequency === "daily" ||
        localWeekday(block.start, tzOffsetMinutes) === weekday,
    );

    const confirmableBlocks = applicableBlocks.filter(
      (block) => block.confirmation !== "none",
    );

    let confirmedValue = 0;

    if (confirmableBlocks.length > 0) {
      const period =
        periodForFrequency(frequency, dayStart, tzOffsetMinutes).start;

      for (const block of confirmableBlocks) {
        const completion = completionsByKey.get(
          `${block.id}:${period.getTime()}`,
        );
        if (!completion) continue;

        if (block.confirmation === "checklist") {
          if (completion.value === "true") confirmedValue += 1;
        } else if (block.confirmation === "score") {
          // Nota 1-10: vale 0.1 a 1.0 (so 10 vale um checkbox completo).
          const score = Number.parseInt(completion.value, 10);
          if (!Number.isNaN(score)) confirmedValue += score / 10;
        }
      }
    }

    progress.push({
      date: dayStart.toISOString(),
      value:
        confirmableBlocks.length > 0
          ? Math.round((confirmedValue / confirmableBlocks.length) * 100)
          : null,
      confirmableBlocks: confirmableBlocks.length,
      confirmedValue: Math.round(confirmedValue * 10) / 10,
    });
  }

  return NextResponse.json({
    routine,
    confirmableBlockCount,
    progress,
    streak: computeStreak(progress, today),
    period: periodForFrequency(frequency, today, tzOffsetMinutes),
    daysWithRecords,
  });
}
