import type { Prisma } from "@/generated/prisma/client";
import type { DayFilter, EventConfirmation, Frequency } from "@/types/domain";
import { asFrequency } from "./api";
import { localWeekday, periodForFrequency } from "./completions";
import { markSubtaskDoneCascade, markTaskDoneCascade } from "./subtask-cascade";

/**
 * Conexões entre tarefas/sub-tarefas e blocos de tempo (direção server-side).
 *
 * Regras:
 * - Bloco confirmado -> completa a entidade conectada quando TODAS as
 *   conexões dela estiverem satisfeitas (confirmedCount >= requiredCount).
 * - Entidade que transiciona para concluída (por qualquer via) auto-confirma
 *   os blocos conectados no período atual (checklist "true", score "10"),
 *   respeitando o dayFilter e o horário do bloco (só confirma se o bloco já
 *   começou no período) — sem sobrescrever confirmações explícitas do período
 *   e sem inflar contagens de entidades já concluídas.
 * - Propagação reversível: reabrir entidade remove as auto-confirmações que
 *   ela originou e reavalia as entidades conectadas aos mesmos blocos;
 *   desconfirmar um bloco reabre as entidades cujas conexões ficaram
 *   insatisfeitas. Explicitação do usuário sempre vence.
 * - requiredCount conta apenas as confirmações do bloco feitas A PARTIR da
 *   criação da conexão (updatedAt >= createdAt): marcações anteriores à
 *   conexão não contam, só a partir do momento em que ela existe.
 * - O dayFilter é avaliado sobre o DIA APLICÁVEL da confirmação: para rotina
 *   diária, o próprio dia; para semanal, o dia da semana em que o bloco
 *   ocorre dentro da semana do período.
 * - Ciclos são seguros: upserts idempotentes + propagação só em transição.
 */

type Tx = Prisma.TransactionClient;

export const connectionInclude = {
  timeBlock: { include: { routine: true } },
} as const;

export type ConnectionWithBlock = Prisma.TaskBlockConnectionGetPayload<{
  include: typeof connectionInclude;
}>;

type CompletionLike = { periodStart: Date; value: string; updatedAt: Date };

type EntityRef = { taskId: string | null; subtaskId: string | null };

const DAY_MS = 86_400_000;

/** Chave canônica de uma entidade, usada em sourceEntityId das auto-confirmações. */
function entityKey(taskId: string | null, subtaskId: string | null): string {
  return taskId ? `task:${taskId}` : `subtask:${subtaskId}`;
}

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
    ? new Date(periodStart.getTime() + blockWeekday * DAY_MS)
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

/** Dia da semana (0-6) de uma data local "YYYY-MM-DD". */
export function localDateWeekday(dateString: string): number {
  const [year, month, day] = dateString.split("-").map(Number);
  // A string já é a data local do usuário: o dia da semana é o nominal,
  // independente do fuso (meia-noite local expressa em UTC muda, o dia não).
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/**
 * Um dayFilter é satisfazível para o bloco? Blocos semanais só ocorrem no
 * próprio dia da semana: weekday:N com N diferente e datas de outro dia da
 * semana nunca casam (contagem sempre 0). Blocos diários aceitam qualquer
 * filtro. Garante que a API nunca crie conexões impossíveis de satisfazer.
 */
export function isDayFilterSatisfiable(
  dayFilter: DayFilter,
  frequency: Frequency,
  blockWeekday: number,
): boolean {
  if (dayFilter === "all" || frequency === "daily") return true;
  if (dayFilter.startsWith("weekday:")) {
    return Number(dayFilter.slice("weekday:".length)) === blockWeekday;
  }
  return localDateWeekday(dayFilter.slice("date:".length)) === blockWeekday;
}

/**
 * A quantidade exigida é alcançável com o filtro? Um filtro date: só casa
 * com uma única data/período: exigir mais de 1 confirmação é impossível.
 */
export function isRequiredCountReachable(
  requiredCount: number,
  dayFilter: DayFilter,
): boolean {
  if (dayFilter.startsWith("date:")) return requiredCount === 1;
  return true;
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

/** Uma confirmação satisfaz o filtro de dia e o valor do bloco? (função pura). */
export function confirmationCounts(
  completion: CompletionLike,
  dayFilter: DayFilter,
  mode: EventConfirmation,
  frequency: Frequency,
  blockWeekday: number,
  tzOffsetMinutes: number,
): boolean {
  return (
    confirmationMatchesDayFilter(
      completion.periodStart,
      dayFilter,
      frequency,
      blockWeekday,
      tzOffsetMinutes,
    ) && confirmationValueCounts(completion.value, mode)
  );
}

/**
 * Quantas confirmações satisfazem o dayFilter da conexão a partir da criação
 * dela (updatedAt >= createdAt): marcações anteriores à conexão não contam.
 */
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
      completion.updatedAt >= connection.createdAt &&
      confirmationCounts(
        completion,
        dayFilter,
        mode,
        frequency,
        blockWeekday,
        tzOffsetMinutes,
      ),
  ).length;
}

/**
 * Quantas confirmações satisfazem o dayFilter MAS foram feitas antes da
 * criação da conexão (não contam, mas explicam ao usuário por que a contagem
 * está baixa). Só considera confirmações desde a conexão mais antiga do bloco
 * (janela carregada), mantendo a consulta com volume limitado.
 */
export function countBeforeConnection(
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
      completion.updatedAt < connection.createdAt &&
      confirmationCounts(
        completion,
        dayFilter,
        mode,
        frequency,
        blockWeekday,
        tzOffsetMinutes,
      ),
  ).length;
}

/**
 * Carrega as confirmações dos blocos de uma vez, agrupadas por bloco, mas só
 * as que são relevantes para as conexões informadas: a partir da confirmação
 * mais antiga criada (por bloco). Confirmações anteriores à conexão mais
 * antiga não afetam confirmedCount de nenhuma conexão e são irrelevantes para
 * a satisfação.
 */
export async function loadCompletionsByBlock(
  tx: Tx,
  connections: { timeBlockId: string; createdAt: Date }[],
): Promise<Map<string, CompletionLike[]>> {
  const minCreatedByBlock = new Map<string, Date>();
  for (const connection of connections) {
    const current = minCreatedByBlock.get(connection.timeBlockId);
    if (!current || connection.createdAt < current) {
      minCreatedByBlock.set(connection.timeBlockId, connection.createdAt);
    }
  }
  if (minCreatedByBlock.size === 0) return new Map();

  const ors: Prisma.TimeBlockCompletionWhereInput[] = [];
  for (const [blockId, minCreated] of minCreatedByBlock) {
    ors.push({ timeBlockId: blockId, updatedAt: { gte: minCreated } });
  }

  const completions = await tx.timeBlockCompletion.findMany({
    where: { OR: ors },
  });

  const byBlock = new Map<string, CompletionLike[]>();
  for (const completion of completions) {
    const list = byBlock.get(completion.timeBlockId) ?? [];
    list.push({
      periodStart: completion.periodStart,
      value: completion.value,
      updatedAt: completion.updatedAt,
    });
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
  countedBefore: number;
} {
  return {
    id: connection.id,
    taskId: connection.taskId,
    subtaskId: connection.subtaskId,
    timeBlockId: connection.timeBlockId,
    requiredCount: connection.requiredCount,
    dayFilter: connection.dayFilter as DayFilter,
    confirmedCount: countConfirmed(connection, completions, tzOffsetMinutes),
    countedBefore: countBeforeConnection(
      connection,
      completions,
      tzOffsetMinutes,
    ),
  };
}

/**
 * Início da ocorrência do bloco no período: para diária, o próprio dia no
 * horário do bloco; para semanal, o dia da semana do bloco dentro da semana
 * do período, no horário do bloco. Blocos "all day" começam à meia-noite.
 */
function occurrenceStartForPeriod(
  block: { start: Date; isAllDay: boolean },
  periodStart: Date,
  frequency: Frequency,
  tzOffsetMinutes: number,
): Date {
  const blockWeekday = localWeekday(block.start, tzOffsetMinutes);
  const occurrenceDay =
    frequency === "weekly"
      ? new Date(periodStart.getTime() + blockWeekday * DAY_MS)
      : periodStart;
  if (block.isAllDay) return occurrenceDay;
  const timeOfDayMs =
    ((block.start.getTime() - tzOffsetMinutes * 60_000) % DAY_MS + DAY_MS) %
    DAY_MS;
  return new Date(occurrenceDay.getTime() + timeOfDayMs);
}

/**
 * Auto-confirma um bloco conectado no período atual quando a entidade é
 * concluída. Respeita o dayFilter (avaliado sobre o dia aplicável do período
 * atual), o horário do bloco (só confirma se o bloco já começou) e NUNCA
 * sobrescreve uma confirmação existente do período (explícita ou auto de
 * outra entidade): a decisão que já existe prevalece. A gravação é atômica
 * (upsert), sem janela de corrida entre verificar e criar.
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
  const period = periodForFrequency(frequency, now, tzOffsetMinutes);
  if (
    !confirmationMatchesDayFilter(
      period.start,
      connection.dayFilter as DayFilter,
      frequency,
      blockWeekday,
      tzOffsetMinutes,
    )
  ) {
    return;
  }

  const occurrenceStart = occurrenceStartForPeriod(
    block,
    period.start,
    frequency,
    tzOffsetMinutes,
  );
  if (now.getTime() < occurrenceStart.getTime()) return;

  const sourceEntityId = entityKey(connection.taskId, connection.subtaskId);

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
      value: block.confirmation === "checklist" ? "true" : "10",
      source: "auto",
      sourceEntityId,
    },
    update: {},
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
 * Núcleo da propagação: avalia as entidades das conexões informadas (todas
 * as conexões de cada entidade) e conclui as que transicionam quando TODAS
 * estiverem satisfeitas; entidades concluídas confirmam os blocos conectados
 * no período atual (propagação unificada, sem inflação de contagens).
 */
export async function completeEntitiesForConnections(
  tx: Tx,
  userId: string,
  connections: { taskId: string | null; subtaskId: string | null }[],
  tzOffsetMinutes: number,
  now: Date = new Date(),
): Promise<void> {
  const taskIds = [
    ...new Set(
      connections
        .map((c) => c.taskId)
        .filter((id): id is string => id !== null),
    ),
  ];
  const subtaskIds = [
    ...new Set(
      connections
        .map((c) => c.subtaskId)
        .filter((id): id is string => id !== null),
    ),
  ];

  if (taskIds.length === 0 && subtaskIds.length === 0) return;

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
    entityConnections,
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
  // novas confirmações (senão a contagem inflaria com o tempo). Recarrega as
  // conexões de TODAS as entidades concluídas (inclusive sub-tarefas
  // completadas pela cascata), não só as da entrada.
  await confirmBlocksForDoneEntities(
    tx,
    [...doneTaskIds],
    [...doneSubtaskIds],
    tzOffsetMinutes,
    now,
  );
}

/**
 * Bloco confirmado propaga para as entidades conectadas: conclui a tarefa ou
 * sub-tarefa (com cascata na árvore) somente quando TODAS as conexões da
 * entidade estiverem satisfeitas; e, para as entidades que de fato
 * transicionaram para concluídas, confirma os blocos conectados no período
 * atual.
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

  await completeEntitiesForConnections(
    tx,
    userId,
    blockConnections,
    tzOffsetMinutes,
    now,
  );
}

/** A entidade existe e está concluída? (entidades removidas = não concluídas) */
async function isEntityDone(tx: Tx, entity: EntityRef): Promise<boolean> {
  if (entity.taskId) {
    const task = await tx.task.findUnique({
      where: { id: entity.taskId },
      select: { done: true },
    });
    return task?.done ?? false;
  }
  const subtask = await tx.subtask.findUnique({
    where: { id: entity.subtaskId! },
    select: { done: true },
  });
  return subtask?.done ?? false;
}

/**
 * Reabre uma entidade e, para sub-tarefas, sobe a cadeia de ancestrais e a
 * tarefa (mesma invariante do caminho done:false das rotas). Retorna todas as
 * entidades que foram reabertas para que a propagação reversa remova as
 * auto-confirmações que cada uma originou.
 */
async function reopenEntityCascade(
  tx: Tx,
  taskId: string | null,
  subtaskId: string | null,
): Promise<EntityRef[]> {
  const reopened: EntityRef[] = [];
  if (subtaskId) {
    if (taskId) {
      const siblings = await tx.subtask.findMany({
        where: { taskId },
        select: { id: true, parentId: true },
      });
      const parentById = new Map<string, string | null>();
      for (const sibling of siblings) {
        parentById.set(sibling.id, sibling.parentId);
      }
      await tx.subtask.update({
        where: { id: subtaskId },
        data: { done: false },
      });
      reopened.push({ taskId: null, subtaskId });
      let currentId = parentById.get(subtaskId) ?? null;
      while (currentId) {
        await tx.subtask.update({
          where: { id: currentId },
          data: { done: false },
        });
        reopened.push({ taskId: null, subtaskId: currentId });
        currentId = parentById.get(currentId) ?? null;
      }
      await tx.task.updateMany({
        where: { id: taskId, done: true },
        data: { done: false },
      });
      reopened.push({ taskId, subtaskId: null });
    } else {
      await tx.subtask.update({
        where: { id: subtaskId },
        data: { done: false },
      });
      reopened.push({ taskId: null, subtaskId });
    }
  } else if (taskId) {
    await tx.task.update({ where: { id: taskId }, data: { done: false } });
    reopened.push({ taskId, subtaskId: null });
  }
  return reopened;
}

/** Todas as conexões de uma entidade. */
async function loadConnectionsOf(
  tx: Tx,
  userId: string,
  entity: EntityRef,
): Promise<ConnectionWithBlock[]> {
  return tx.taskBlockConnection.findMany({
    where: {
      userId,
      OR: entity.taskId
        ? [{ taskId: entity.taskId }]
        : [{ subtaskId: entity.subtaskId }],
    },
    include: connectionInclude,
  });
}

/**
 * Propagação reversa (desfazer). Recebe entidades recém-reabertas (ou em
 * reavaliação) e um conjunto extra de blocos afetados (ex.: quando a entidade
 * foi excluída e suas conexões já sumiram). Para cada entidade:
 * 1. remove as auto-confirmações que ela originou (sourceEntityId);
 * 2. marca os blocos dela como pendentes de reavaliação.
 * Em seguida, para cada bloco pendente, reavalia TODAS as entidades nele
 * conectadas: as que estão concluídas mas com alguma conexão insatisfeita são
 * reabertas (cascata na árvore), reiniciando o ciclo até estabilizar.
 * Entidades concluídas e ainda satisfeitas não são tocadas.
 */
export async function reversePropagate(
  tx: Tx,
  userId: string,
  entities: EntityRef[],
  tzOffsetMinutes: number,
  extraBlockIds: string[] = [],
): Promise<void> {
  const queue: EntityRef[] = [...entities];
  const autosRemoved = new Set<string>();
  let pendingBlocks = new Set<string>(extraBlockIds);

  while (queue.length > 0 || pendingBlocks.size > 0) {
    // 1. Processa fila de entidades.
    while (queue.length > 0) {
      const current = queue.pop()!;
      const key = entityKey(current.taskId, current.subtaskId);

      const done = await isEntityDone(tx, current);
      if (done) {
        // Ainda concluída: só age se as conexões ficaram insatisfeitas.
        const conns = await loadConnectionsOf(tx, userId, current);
        if (conns.length === 0) continue;
        const completions = await loadCompletionsByBlock(tx, conns);
        const satisfied = conns.every(
          (connection) =>
            countConfirmed(
              connection,
              completions.get(connection.timeBlockId) ?? [],
              tzOffsetMinutes,
            ) >= connection.requiredCount,
        );
        if (satisfied) continue;
        const reopened = await reopenEntityCascade(
          tx,
          current.taskId,
          current.subtaskId,
        );
        queue.push(...reopened);
        continue;
      }

      // Não concluída (reaberta ou excluída): remove auto-confirmações dela.
      if (autosRemoved.has(key)) continue;
      autosRemoved.add(key);
      await tx.timeBlockCompletion.deleteMany({
        where: { source: "auto", sourceEntityId: key },
      });
      const conns = await loadConnectionsOf(tx, userId, current);
      for (const connection of conns) {
        pendingBlocks.add(connection.timeBlockId);
      }
    }

    // 2. Reavalia blocos afetados.
    if (pendingBlocks.size === 0) break;
    const blockIds = [...pendingBlocks];
    pendingBlocks = new Set();

    const blockConnections = await tx.taskBlockConnection.findMany({
      where: { userId, timeBlockId: { in: blockIds } },
      include: connectionInclude,
    });
    if (blockConnections.length === 0) continue;

    const entitiesOnBlocks: EntityRef[] = [];
    const seen = new Set<string>();
    for (const connection of blockConnections) {
      const key = connection.taskId ?? connection.subtaskId;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      entitiesOnBlocks.push({
        taskId: connection.taskId,
        subtaskId: connection.subtaskId,
      });
    }

    const allConnections = await tx.taskBlockConnection.findMany({
      where: {
        userId,
        OR: entitiesOnBlocks.map((entity) =>
          entity.taskId
            ? { taskId: entity.taskId }
            : { subtaskId: entity.subtaskId },
        ),
      },
      include: connectionInclude,
    });
    const completionsByBlock = await loadCompletionsByBlock(
      tx,
      allConnections,
    );

    for (const entity of entitiesOnBlocks) {
      const key = entityKey(entity.taskId, entity.subtaskId);
      if (autosRemoved.has(key)) continue;
      const entityConnections = allConnections.filter(
        (connection) =>
          entity.taskId
            ? connection.taskId === entity.taskId
            : connection.subtaskId === entity.subtaskId,
      );
      if (entityConnections.length === 0) continue;
      const satisfied = entityConnections.every(
        (connection) =>
          countConfirmed(
            connection,
            completionsByBlock.get(connection.timeBlockId) ?? [],
            tzOffsetMinutes,
          ) >= connection.requiredCount,
      );
      if (satisfied) continue;
      const done = await isEntityDone(tx, entity);
      if (!done) continue;
      const reopened = await reopenEntityCascade(
        tx,
        entity.taskId,
        entity.subtaskId,
      );
      queue.push(...reopened);
    }
  }
}

/** Propagação reversa a partir de todas as entidades conectadas a um bloco. */
export async function reversePropagateForBlock(
  tx: Tx,
  userId: string,
  blockId: string,
  tzOffsetMinutes: number,
): Promise<void> {
  const blockConnections = await tx.taskBlockConnection.findMany({
    where: { userId, timeBlockId: blockId },
    select: { taskId: true, subtaskId: true },
  });
  if (blockConnections.length === 0) return;
  await reversePropagate(tx, userId, blockConnections, tzOffsetMinutes);
}

/**
 * Propagação reversa para entidades recém-reabertas, removendo também as
 * auto-confirmações que elas originaram e reavaliando os blocos afetados.
 * `removedBlockIds` cobre o caso de exclusão: as conexões da entidade já
 * foram removidas, então os blocos precisam ser informados explicitamente.
 */
export async function reversePropagateForEntities(
  tx: Tx,
  userId: string,
  entities: EntityRef[],
  tzOffsetMinutes: number,
  removedBlockIds: string[] = [],
): Promise<void> {
  if (entities.length === 0 && removedBlockIds.length === 0) return;
  await reversePropagate(tx, userId, entities, tzOffsetMinutes, removedBlockIds);
}