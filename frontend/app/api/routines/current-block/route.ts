import { NextResponse } from "next/server";

import { prisma } from "@/lib/server/prisma";
import {
  localMinutesOfDay,
  localWeekday,
  periodForFrequency,
} from "@/lib/server/completions";
import { asFrequency, parseTzOffset, requireUser } from "@/lib/server/api";
import { confirmationValueCounts } from "@/lib/server/connections";
import type { EventConfirmation } from "@/types/domain";

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

  // So completions que contam como confirmacao (checklist true / score >= 1)
  // removem o bloco da lista; marcar "false" nao esconde o bloco.
  const confirmationByBlock = new Map(
    timeBlocks.map((block) => [block.id, block.confirmation] as const),
  );
  const completedBlockIds = new Set(
    completions
      .filter((completion) =>
        confirmationValueCounts(
          completion.value,
          (confirmationByBlock.get(completion.timeBlockId) ??
            "checklist") as EventConfirmation,
        ),
      )
      .map((completion) => completion.timeBlockId),
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
