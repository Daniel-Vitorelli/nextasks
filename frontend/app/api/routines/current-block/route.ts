import { NextResponse } from "next/server";

import { prisma } from "@/lib/server/prisma";
import {
  localMinutesOfDay,
  localWeekday,
  periodForFrequency,
} from "@/lib/server/completions";
import { asFrequency, parseTzOffset, requireUser } from "@/lib/server/api";

export async function GET(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;

  const url = new URL(request.url);
  const tzOffsetMinutes = parseTzOffset(url.searchParams.get("tzOffset"));

  const routine = await prisma.routine.findFirst({
    where: { userId: user.id, isActive: true },
  });

  if (!routine) {
    return NextResponse.json({ routine: null, blocks: [], period: null });
  }

  const now = new Date();
  const todayWeekday = localWeekday(now, tzOffsetMinutes);
  const nowMinutes = localMinutesOfDay(now, tzOffsetMinutes);
  const period = periodForFrequency(
    asFrequency(routine.frequency),
    now,
    tzOffsetMinutes,
  );

  const timeBlocks = await prisma.timeBlock.findMany({
    where: { routineId: routine.id },
    orderBy: { start: "asc" },
  });

  // Confirmacoes do periodo atual para os blocos da rotina
  const completions = await prisma.timeBlockCompletion.findMany({
    where: {
      userId: user.id,
      timeBlockId: { in: timeBlocks.map((block) => block.id) },
      periodStart: period.start,
    },
  });

  const completedBlockIds = new Set(
    completions.map((completion) => completion.timeBlockId),
  );

  // Rotina diaria vale todos os dias; semanal so no dia da semana do bloco.
  const appliesToday = (start: Date) =>
    routine.frequency === "daily" ||
    localWeekday(start, tzOffsetMinutes) === todayWeekday;

  const isTimedBlockActive = (block: (typeof timeBlocks)[number]) => {
    const start = localMinutesOfDay(block.start, tzOffsetMinutes);
    const end = localMinutesOfDay(block.end, tzOffsetMinutes);
    // Bloco que cruza a meia-noite (end <= start em minutos)
    return end > start
      ? nowMinutes >= start && nowMinutes < end
      : nowMinutes >= start || nowMinutes < end;
  };

  // All-day vale o dia inteiro quando aplicavel hoje; bloco agendado so
  // quando o horario atual esta dentro da janela. Bloco ja confirmado no
  // periodo atual nao aparece.
  const currentBlocks = timeBlocks.filter(
    (block) =>
      !completedBlockIds.has(block.id) &&
      appliesToday(block.start) &&
      (block.isAllDay || isTimedBlockActive(block)),
  );

  return NextResponse.json({ routine, blocks: currentBlocks, period });
}
