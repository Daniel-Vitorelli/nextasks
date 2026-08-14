import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/session";

const unauthorized = () =>
  NextResponse.json({ error: "Unauthorized" }, { status: 401 });

export async function GET() {
  const user = await getUser();

  if (!user) {
    return unauthorized();
  }

  const routine = await prisma.routine.findFirst({
    where: { userId: user.id, isActive: true },
  });

  if (!routine) {
    return NextResponse.json({ routine: null, blocks: [] });
  }

  const timeBlocks = await prisma.timeBlock.findMany({
    where: { routineId: routine.id },
    orderBy: { start: "asc" },
  });

  const now = new Date();
  const todayWeekday = now.getDay();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const minutesOfDay = (date: Date) =>
    date.getHours() * 60 + date.getMinutes();

  // Rotina diária vale todos os dias; semanal só no dia da semana do bloco.
  const appliesToday = (start: Date) =>
    routine.frequency === "daily" || start.getDay() === todayWeekday;

  const isTimedBlockActive = (block: (typeof timeBlocks)[number]) => {
    const start = minutesOfDay(block.start);
    const end = minutesOfDay(block.end);
    // Bloco que cruza a meia-noite (end <= start em minutos)
    return end > start
      ? nowMinutes >= start && nowMinutes < end
      : nowMinutes >= start || nowMinutes < end;
  };

  // All-day vale o dia inteiro quando aplicável hoje; bloco agendado só
  // quando o horário atual está dentro da janela.
  const currentBlocks = timeBlocks.filter(
    (block) =>
      appliesToday(block.start) &&
      (block.isAllDay || isTimedBlockActive(block)),
  );

  return NextResponse.json({ routine, blocks: currentBlocks });
}