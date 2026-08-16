import type { Prisma } from "@/generated/prisma/client";
import type { DayFilter, EventConfirmation } from "@/types/domain";
import { asFrequency } from "./api";
import { localWeekday, periodForFrequency } from "./completions";
import { markSubtaskDoneCascade, markTaskDoneCascade } from "./subtask-cascade";

/**
 * Conexões entre tarefas/sub-tarefas e blocos de tempo (direção server-side).
 *
 * Regras (definidas com o usuário):
 * - Bloco confirmado -> completa a entidade conectada quando TODAS as
 *   conexões dela estiverem satisfeitas (confirmedCount >= requiredCount).
 * - Entidade marcada como concluída -> auto-confirma os blocos conectados
 *   no período atual (checklist "true", score "10"), respeitando o dayFilter.
 * - Desmarcar NÃO propaga: a cascata só acontece na direção de concluir.
 * - requiredCount conta todas as confirmações históricas do bloco que
 *   satisfazem o dayFilter da conexão.
 * - Ciclos são seguros: upserts idempotentes.
 */

type Tx = Prisma.TransactionClient;

export type ConnectionWithBlock = Prisma.TaskBlockConnectionGetPayload<{
  include: { timeBlock: { include: { routine: true } } };
}>;

function localDateString(utc: Date, tzOffsetMinutes: number): string {
  const local = new Date(utc.getTime() - tzOffsetMinutes * 60_000);
  const month = String(local.getMonth() + 1).padStart(2, "0");
  const day = String(local.getDate()).padStart(2, "0");
  return `${local.getFullYear()}-${month}-${day}`;
}

/** O dia de uma confirmação (periodStart) satisfaz o dayFilter da conexão? */
export function confirmationMatchesDayFilter(
  periodStart: Date,
  dayFilter: DayFilter,
  tzOffsetMinutes: number,
): boolean {
  if (dayFilter === "all") return true;
  if (dayFilter.startsWith("weekday:")) {
    return (
      localWeekday(periodStart, tzOffsetMinutes) ===
      Number(dayFilter.slice("weekday:".length))
    );
  }
  return (
    localDateString(periodStart, tzOffsetMinutes) ===
    dayFilter.slice("date:".length)
  );
}

/** Uma confirmação conta como "bloco feito"? Checklist: só "true"; score: nota >= 1. */
export function confirmationValueCounts(
  value: string,
  mode: EventConfirmation,
): boolean {
  if (mode === "checklist") return value === "true";
  if (mode === "score") {
    const score = Number.parseInt(value, 10);
    return !Number.isNaN(score) && score >= 1;
  }
  return false;
}

/** Quantas confirmações do bloco satisfazem o dayFilter da conexão. */
export async function countConfirmedForConnection(
  tx: Tx,
  connection: ConnectionWithBlock,
  tzOffsetMinutes: number,
): Promise<number> {
  const dayFilter = connection.dayFilter as DayFilter;
  const mode = connection.timeBlock.confirmation as EventConfirmation;
  const completions = await tx.timeBlockCompletion.findMany({
    where: { timeBlockId: connection.timeBlockId },
  });
  return completions.filter(
    (completion) =>
      confirmationMatchesDayFilter(
        completion.periodStart,
        dayFilter,
        tzOffsetMinutes,
      ) && confirmationValueCounts(completion.value, mode),
  ).length;
}

/**
 * Auto-confirma um bloco conectado no período atual quando a entidade é
 * concluída. Respeita o dayFilter: se hoje não bate, não confirma.
 */
export async function confirmBlockForConnection(
  tx: Tx,
  connection: ConnectionWithBlock,
  tzOffsetMinutes: number,
  now: Date = new Date(),
): Promise<void> {
  const block = connection.timeBlock;
  if (block.confirmation === "none") return;
  if (
    !confirmationMatchesDayFilter(
      now,
      connection.dayFilter as DayFilter,
      tzOffsetMinutes,
    )
  ) {
    return;
  }

  const period = periodForFrequency(
    asFrequency(block.routine.frequency),
    now,
    tzOffsetMinutes,
  );
  const value = block.confirmation === "checklist" ? "true" : "10";

  await tx.timeBlockCompletion.upsert({
    where: {
      timeBlockId_periodStart: {
        timeBlockId: block.id,
        periodStart: period.start,
      },
    },
    create: {
      timeBlockId: block.id,
      userId: connection.userId,
      periodStart: period.start,
      periodEnd: period.end,
      value,
    },
    update: { value },
  });
}

/** Entidades concluídas propagam: confirmam os blocos conectados no período atual. */
export async function confirmBlocksForDoneEntities(
  tx: Tx,
  taskIds: string[],
  subtaskIds: string[],
  tzOffsetMinutes: number,
  now: Date = new Date(),
): Promise<void> {
  if (taskIds.length === 0 && subtaskIds.length === 0) return;

  const connections = await tx.taskBlockConnection.findMany({
    where: {
      OR: [
        ...(taskIds.length > 0 ? [{ taskId: { in: taskIds } }] : []),
        ...(subtaskIds.length > 0 ? [{ subtaskId: { in: subtaskIds } }] : []),
      ],
    },
    include: { timeBlock: { include: { routine: true } } },
  });

  for (const connection of connections) {
    await confirmBlockForConnection(tx, connection, tzOffsetMinutes, now);
  }
}

async function allConnectionsSatisfied(
  tx: Tx,
  where: Prisma.TaskBlockConnectionWhereInput,
  tzOffsetMinutes: number,
): Promise<boolean> {
  const connections = await tx.taskBlockConnection.findMany({
    where,
    include: { timeBlock: { include: { routine: true } } },
  });
  if (connections.length === 0) return false;

  const counts = await Promise.all(
    connections.map((connection) =>
      countConfirmedForConnection(tx, connection, tzOffsetMinutes),
    ),
  );
  return connections.every(
    (connection, index) => counts[index] >= connection.requiredCount,
  );
}

/**
 * Bloco confirmado propaga para as entidades conectadas: conclui a tarefa ou
 * sub-tarefa (com cascata na árvore) somente quando TODAS as conexões da
 * entidade estiverem satisfeitas. Chamado dentro da transação da confirmação.
 */
export async function completeEntitiesForBlock(
  tx: Tx,
  userId: string,
  blockId: string,
  tzOffsetMinutes: number,
): Promise<void> {
  const connections = await tx.taskBlockConnection.findMany({
    where: { userId, timeBlockId: blockId },
    select: { taskId: true, subtaskId: true },
  });
  if (connections.length === 0) return;

  const taskIds = [
    ...new Set(connections.map((c) => c.taskId).filter((id) => id !== null)),
  ] as string[];
  const subtaskIds = [
    ...new Set(
      connections.map((c) => c.subtaskId).filter((id) => id !== null),
    ),
  ] as string[];

  for (const taskId of taskIds) {
    const satisfied = await allConnectionsSatisfied(
      tx,
      { userId, taskId },
      tzOffsetMinutes,
    );
    if (satisfied) {
      await markTaskDoneCascade(tx, taskId);
    }
  }

  if (subtaskIds.length > 0) {
    const subtasks = await tx.subtask.findMany({
      where: { id: { in: subtaskIds } },
      select: { id: true, taskId: true },
    });
    for (const subtask of subtasks) {
      const satisfied = await allConnectionsSatisfied(
        tx,
        { subtaskId: subtask.id },
        tzOffsetMinutes,
      );
      if (satisfied) {
        await markSubtaskDoneCascade(tx, subtask.taskId, subtask.id);
      }
    }
  }
}