import type { Prisma } from "@/generated/prisma/client";
import type { DayFilter, EventConfirmation, Frequency } from "@/types/domain";
import { asFrequency } from "./api";
import { localWeekday, periodForFrequency } from "./completions";
import { markSubtaskDoneCascade, markTaskDoneCascade } from "./subtask-cascade";

/**
 * Conexões entre tarefas/sub-tarefas e blocos de tempo (direção server-side).
 *
 * Regras (definidas com o usuário):
 * - Bloco confirmado -> completa a entidade conectada quando TODAS as
 *   conexões dela estiverem satisfeitas (confirmedCount >= requiredCount).
 * - Entidade que transiciona para concluída (por qualquer via) auto-confirma
 *   os blocos conectados no período atual (checklist "true", score "10"),
 *   respeitando o dayFilter — sem sobrescrever confirmações explícitas do
 *   período e sem inflar contagens de entidades já concluídas.
 * - Desmarcar NÃO propaga: a cascata só acontece na direção de concluir.
 * - requiredCount conta todas as confirmações históricas do bloco que
 *   satisfazem o dayFilter da conexão.
 * - O dayFilter é avaliado sobre o DIA APLICÁVEL da confirmação: para rotina
 *   diária, o próprio dia; para semanal, o dia da semana em que o bloco
 *   ocorre dentro da semana do período (o bloco semanal não "acontece" no
 *   domingo só porque o período começa lá).
 * - Ciclos são seguros: upserts idempotentes + propagação só em transição.
 */

type Tx = Prisma.TransactionClient;

export const connectionInclude = {
  timeBlock: { include: { routine: true } },
} as const;

export type ConnectionWithBlock = Prisma.TaskBlockConnectionGetPayload<{
  include: typeof connectionInclude;
}>;

type CompletionLike = { periodStart: Date; value: string };

function localDateString(utc: Date, tzOffsetMinutes: number): string {
  const local = new Date(utc.getTime() - tzOffsetMinutes * 60_000);
  const month = String(local.getUTCMonth() + 1).padStart(2, "0");
  const day = String(local.getUTCDate()).padStart(2, "0");
  return `${local.getUTCFullYear()}-${month}-${day}`;
}

/**
 * Dia aplicável de uma confirmação, usado para casar com o dayFilter.
 * - Rotina diária: o período é um dia local (periodStart já é o dia).
 * - Rotina semanal: o período é a semana local (periodStart = domingo 00:00)
 *   e o bloco ocorre `blockWeekday` dias depois dela.
 */
export function applicableDayUtc(
  periodStart: Date,
  frequency: Frequency,
  blockWeekday: number,
): Date {
  return frequency === "weekly"
    ? new Date(periodStart.getTime() + blockWeekday * 86_400_000)
    : periodStart;
}

/** O dia aplicável de uma confirmação satisfaz o dayFilter da conexão? */
export function confirmationMatchesDayFilter(
  periodStart: Date,
  dayFilter: DayFilter,
  frequency: Frequency,
  blockWeekday: number,
  tzOffsetMinutes: number,
): boolean {
  if (dayFilter === "all") return true;
  const applicableDay = applicableDayUtc(periodStart, frequency, blockWeekday);
  if (dayFilter.startsWith("weekday:")) {
    return (
      localWeekday(applicableDay, tzOffsetMinutes) ===
      Number(dayFilter.slice("weekday:".length))
    );
  }
  return (
    localDateString(applicableDay, tzOffsetMinutes) ===
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

/** Quantas confirmações satisfazem o dayFilter da conexão (função pura). */
export function countConfirmed(
  connection: ConnectionWithBlock,
  completions: CompletionLike[],
  tzOffsetMinutes: number,
): number {
  const dayFilter = connection.dayFilter as DayFilter;
  const mode = connection.timeBlock.confirmation as EventConfirmation;
  const frequency = asFrequency(connection.timeBlock.routine.frequency);
  const blockWeekday = localWeekday(
    connection.timeBlock.start,
    tzOffsetMinutes,
  );

  return completions.filter(
    (completion) =>
      confirmationMatchesDayFilter(
        completion.periodStart,
        dayFilter,
        frequency,
        blockWeekday,
        tzOffsetMinutes,
      ) && confirmationValueCounts(completion.value, mode),
  ).length;
}

/** Carrega as confirmações de vários blocos de uma vez, agrupadas por bloco. */
export async function loadCompletionsByBlock(
  tx: Tx,
  blockIds: string[],
): Promise<Map<string, CompletionLike[]>> {
  const distinct = [...new Set(blockIds)];
  if (distinct.length === 0) return new Map();

  const completions = await tx.timeBlockCompletion.findMany({
    where: { timeBlockId: { in: distinct } },
  });

  const byBlock = new Map<string, CompletionLike[]>();
  for (const completion of completions) {
    const list = byBlock.get(completion.timeBlockId) ?? [];
    list.push({ periodStart: completion.periodStart, value: completion.value });
    byBlock.set(completion.timeBlockId, list);
  }
  return byBlock;
}

/** Serializa uma conexão para a API (com confirmedCount). */
export function toConnectionRow(
  connection: ConnectionWithBlock,
  completions: CompletionLike[],
  tzOffsetMinutes: number,
): {
  id: string;
  taskId: string | null;
  subtaskId: string | null;
  timeBlockId: string;
  requiredCount: number;
  dayFilter: DayFilter;
  confirmedCount: number;
} {
  return {
    id: connection.id,
    taskId: connection.taskId,
    subtaskId: connection.subtaskId,
    timeBlockId: connection.timeBlockId,
    requiredCount: connection.requiredCount,
    dayFilter: connection.dayFilter as DayFilter,
    confirmedCount: countConfirmed(connection, completions, tzOffsetMinutes),
  };
}

/**
 * Auto-confirma um bloco conectado no período atual quando a entidade é
 * concluída. Respeita o dayFilter (avaliado sobre o dia aplicável do período
 * atual) e NUNCA sobrescreve uma confirmação explícita do período: se o
 * usuário já confirmou/desconfirmou o bloco, a decisão dele prevalece.
 */
export async function confirmBlockForConnection(
  tx: Tx,
  connection: ConnectionWithBlock,
  tzOffsetMinutes: number,
  now: Date = new Date(),
): Promise<void> {
  const block = connection.timeBlock;
  if (block.confirmation === "none") return;

  const frequency = asFrequency(block.routine.frequency);
  const blockWeekday = localWeekday(block.start, tzOffsetMinutes);
  if (
    !confirmationMatchesDayFilter(
      now,
      connection.dayFilter as DayFilter,
      frequency,
      blockWeekday,
      tzOffsetMinutes,
    )
  ) {
    return;
  }

  const period = periodForFrequency(frequency, now, tzOffsetMinutes);
  const existing = await tx.timeBlockCompletion.findUnique({
    where: {
      timeBlockId_periodStart: {
        timeBlockId: block.id,
        periodStart: period.start,
      },
    },
  });
  if (existing) return;

  await tx.timeBlockCompletion.create({
    data: {
      timeBlockId: block.id,
      userId: connection.userId,
      periodStart: period.start,
      periodEnd: period.end,
      value: block.confirmation === "checklist" ? "true" : "10",
    },
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
    include: connectionInclude,
  });

  for (const connection of connections) {
    await confirmBlockForConnection(tx, connection, tzOffsetMinutes, now);
  }
}

/**
 * Bloco confirmado propaga para as entidades conectadas: conclui a tarefa ou
 * sub-tarefa (com cascata na árvore) somente quando TODAS as conexões da
 * entidade estiverem satisfeitas; e, para as entidades que de fato
 * transicionaram para concluídas, confirma os blocos conectados no período
 * atual (propagação unificada, sem inflação de contagens).
 */
export async function completeEntitiesForBlock(
  tx: Tx,
  userId: string,
  blockId: string,
  tzOffsetMinutes: number,
  now: Date = new Date(),
): Promise<void> {
  const blockConnections = await tx.taskBlockConnection.findMany({
    where: { userId, timeBlockId: blockId },
    select: { taskId: true, subtaskId: true },
  });
  if (blockConnections.length === 0) return;

  const taskIds = [
    ...new Set(
      blockConnections
        .map((c) => c.taskId)
        .filter((id): id is string => id !== null),
    ),
  ];
  const subtaskIds = [
    ...new Set(
      blockConnections
        .map((c) => c.subtaskId)
        .filter((id): id is string => id !== null),
    ),
  ];

  const entityConnections = await tx.taskBlockConnection.findMany({
    where: {
      userId,
      OR: [
        ...(taskIds.length > 0 ? [{ taskId: { in: taskIds } }] : []),
        ...(subtaskIds.length > 0 ? [{ subtaskId: { in: subtaskIds } }] : []),
      ],
    },
    include: connectionInclude,
  });
  const completionsByBlock = await loadCompletionsByBlock(
    tx,
    entityConnections.map((c) => c.timeBlockId),
  );

  const satisfied = (connection: ConnectionWithBlock) =>
    countConfirmed(
      connection,
      completionsByBlock.get(connection.timeBlockId) ?? [],
      tzOffsetMinutes,
    ) >= connection.requiredCount;

  const doneTaskIds = new Set<string>();
  const doneSubtaskIds = new Set<string>();

  for (const taskId of taskIds) {
    const connections = entityConnections.filter((c) => c.taskId === taskId);
    if (!connections.every(satisfied)) continue;

    const { completedSubtaskIds, taskCompleted } =
      await markTaskDoneCascade(tx, taskId);
    if (taskCompleted) doneTaskIds.add(taskId);
    for (const id of completedSubtaskIds) doneSubtaskIds.add(id);
  }

  if (subtaskIds.length > 0) {
    const subtasks = await tx.subtask.findMany({
      where: { id: { in: subtaskIds } },
      select: { id: true, taskId: true },
    });
    for (const subtask of subtasks) {
      const connections = entityConnections.filter(
        (c) => c.subtaskId === subtask.id,
      );
      if (!connections.every(satisfied)) continue;

      const { completedSubtaskIds, completedTask } =
        await markSubtaskDoneCascade(tx, subtask.taskId, subtask.id);
      if (completedTask) doneTaskIds.add(subtask.taskId);
      for (const id of completedSubtaskIds) doneSubtaskIds.add(id);
    }
  }

  if (doneTaskIds.size === 0 && doneSubtaskIds.size === 0) return;

  // Só as entidades que transicionaram confirmam blocos: repetir confirmação
  // de bloco num período em que a entidade já estava feita não deve criar
  // novas confirmações (senão a contagem inflaria com o tempo).
  const connectionsToConfirm = entityConnections.filter(
    (connection) =>
      (connection.taskId !== null && doneTaskIds.has(connection.taskId)) ||
      (connection.subtaskId !== null && doneSubtaskIds.has(connection.subtaskId)),
  );
  for (const connection of connectionsToConfirm) {
    await confirmBlockForConnection(tx, connection, tzOffsetMinutes, now);
  }
}