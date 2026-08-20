import { prisma } from "@/lib/server/prisma";
import { localWeekday, startOfDayUtc } from "@/lib/server/completions";
import type { ScheduledOccurrence } from "@/types/domain";

const DAY_MS = 86_400_000;

/**
 * Materializa a recorrência dos blocos das rotinas ativas do usuário numa
 * faixa de datas, gerando ocorrências concretas no calendário.
 *
 * Convenção (alinhada ao resto do app): o horário de parede do bloco
 * (hora/minuto em que ele acontece no fuso do usuário) é derivado do instante
 * armazenado deslocado pelo offset do usuário — a mesma regra usada por
 * `occurrenceStartForPeriod` na lógica de confirmação.
 */
export async function materializeSchedule(
  userId: string,
  rangeStart: Date,
  rangeEnd: Date,
  tzOffsetMinutes: number,
): Promise<ScheduledOccurrence[]> {
  const routines = await prisma.routine.findMany({
    where: { userId, isActive: true },
    orderBy: { name: "asc" },
  });

  const blockLists = await prisma.timeBlock.findMany({
    where: { routine: { userId, isActive: true } },
    orderBy: [{ start: "asc" }, { id: "asc" }],
  });
  const blocksByRoutine = new Map<string, typeof blockLists>();
  for (const block of blockLists) {
    const list = blocksByRoutine.get(block.routineId) ?? [];
    list.push(block);
    blocksByRoutine.set(block.routineId, list);
  }

  const firstDay = startOfDayUtc(rangeStart, tzOffsetMinutes);
  const lastDay = startOfDayUtc(rangeEnd, tzOffsetMinutes);
  const endDayByRoutine = new Map(
    routines.map((routine) => [
      routine.id,
      routine.duration === "until" && routine.endDate
        ? startOfDayUtc(routine.endDate, tzOffsetMinutes).getTime()
        : null,
    ]),
  );
  const occurrences: ScheduledOccurrence[] = [];

  for (let day = firstDay.getTime(); day <= lastDay.getTime(); day += DAY_MS) {
    const dayDate = new Date(day);
    const dayWeekday = localWeekday(dayDate, tzOffsetMinutes);

    for (const routine of routines) {
      const endDay = endDayByRoutine.get(routine.id);
      if (endDay !== null && endDay !== undefined && day > endDay) {
        continue;
      }

      for (const block of blocksByRoutine.get(routine.id) ?? []) {
        if (
          routine.frequency === "weekly" &&
          dayWeekday !== localWeekday(block.start, tzOffsetMinutes)
        ) {
          continue;
        }

        const start = new Date(
          day + timeOfDayOf(block.start, tzOffsetMinutes),
        );
        let end = new Date(day + timeOfDayOf(block.end, tzOffsetMinutes));

        if (block.isAllDay) {
          start.setTime(day);
          end = new Date(day + DAY_MS);
        } else if (end.getTime() <= start.getTime()) {
          // Bloco que cruza a meia-noite: o fim cai no dia seguinte.
          end = new Date(end.getTime() + DAY_MS);
        }

        occurrences.push({
          id: `${block.id}:${day}`,
          title: block.title,
          description: block.description,
          start: start.toISOString(),
          end: end.toISOString(),
          isAllDay: block.isAllDay,
          color: block.color as ScheduledOccurrence["color"],
          confirmation:
            block.confirmation as ScheduledOccurrence["confirmation"],
          routineId: routine.id,
          routineName: routine.name,
          blockId: block.id,
        });
      }
    }
  }

  return occurrences;
}

/** Horário de parede (em minutos desde 00:00 do fuso) de um instante. */
function timeOfDayOf(blockStart: Date, tzOffsetMinutes: number): number {
  return (
    ((blockStart.getTime() - tzOffsetMinutes * 60_000) % DAY_MS + DAY_MS) %
    DAY_MS
  );
}