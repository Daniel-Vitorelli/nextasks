import type { Prisma } from "@/generated/prisma/client";

/**
 * Cascata de conclusão server-side (transacional) para tarefas e sub-tarefas.
 * Reflete a invariante da árvore: marcar um nó concluído conclui toda a
 * sub-árvore abaixo dele e sobe a cadeia enquanto todos os filhos estiverem
 * concluídos; marcar a tarefa concluída conclui todas as sub-tarefas.
 *
 * Os retornos indicam apenas as entidades que de fato transicionaram
 * (pendente -> concluída), para que a propagação para blocos de tempo
 * conectados não crie confirmações em excesso.
 */

export interface MarkSubtaskDoneResult {
  /** Sub-tarefas que transicionaram para concluídas (nó + sub-árvore + ancestrais). */
  completedSubtaskIds: string[];
  /** A tarefa transicionou para concluída (todas as raízes concluídas). */
  completedTask: boolean;
}

/**
 * Marca uma tarefa e todas as suas sub-tarefas pendentes como concluídas.
 * Retorna as sub-tarefas que transicionaram e se a tarefa transicionou.
 */
export async function markTaskDoneCascade(
  tx: Prisma.TransactionClient,
  taskId: string,
): Promise<{ completedSubtaskIds: string[]; taskCompleted: boolean }> {
  const task = await tx.task.findUnique({
    where: { id: taskId },
    select: { done: true },
  });
  const undone = await tx.subtask.findMany({
    where: { taskId, done: false },
    select: { id: true },
  });

  await tx.task.update({ where: { id: taskId }, data: { done: true } });

  if (undone.length > 0) {
    await tx.subtask.updateMany({
      where: { id: { in: undone.map((item) => item.id) }, done: false },
      data: { done: true },
    });
  }

  return {
    completedSubtaskIds: undone.map((item) => item.id),
    taskCompleted: task?.done === false,
  };
}

/**
 * Marca uma sub-tarefa e sua sub-árvore como concluídas, subindo a cadeia.
 * Retorna apenas as entidades que transicionaram (pendente -> concluída).
 */
export async function markSubtaskDoneCascade(
  tx: Prisma.TransactionClient,
  taskId: string,
  subtaskId: string,
): Promise<MarkSubtaskDoneResult> {
  const siblings = await tx.subtask.findMany({
    where: { taskId },
    select: { id: true, parentId: true, done: true },
  });

  const childrenByParent = new Map<string | null, string[]>();
  const parentById = new Map<string, string | null>();
  const preDone = new Map(siblings.map((item) => [item.id, item.done]));
  for (const subtask of siblings) {
    const children = childrenByParent.get(subtask.parentId) ?? [];
    children.push(subtask.id);
    childrenByParent.set(subtask.parentId, children);
    parentById.set(subtask.id, subtask.parentId);
  }

  const descendantIds: string[] = [];
  const stack = [...(childrenByParent.get(subtaskId) ?? [])];
  while (stack.length > 0) {
    const current = stack.pop()!;
    descendantIds.push(current);
    stack.push(...(childrenByParent.get(current) ?? []));
  }

  const doneById = new Map(preDone);
  const nodeWasDone = doneById.get(subtaskId) === true;
  doneById.set(subtaskId, true);
  for (const id of descendantIds) {
    doneById.set(id, true);
  }

  const completeIds: string[] = [];
  let currentId = parentById.get(subtaskId) ?? null;
  while (currentId) {
    const children = childrenByParent.get(currentId) ?? [];
    const allChildrenDone =
      children.length > 0 &&
      children.every((child) => doneById.get(child) === true);
    if (!allChildrenDone) break;
    completeIds.push(currentId);
    doneById.set(currentId, true);
    currentId = parentById.get(currentId) ?? null;
  }

  const roots = childrenByParent.get(null) ?? [];
  const completeTask =
    roots.length > 0 &&
    roots.every((root) => doneById.get(root) === true);

  const completedSubtaskIds = [
    ...(nodeWasDone ? [] : [subtaskId]),
    ...descendantIds.filter((id) => preDone.get(id) !== true),
    ...completeIds.filter((id) => preDone.get(id) !== true),
  ];

  let completedTask = false;
  if (completeTask) {
    const task = await tx.task.findUnique({
      where: { id: taskId },
      select: { done: true },
    });
    completedTask = task?.done === false;
  }

  if (descendantIds.length > 0) {
    await tx.subtask.updateMany({
      where: { id: { in: descendantIds }, done: false },
      data: { done: true },
    });
  }

  if (completeIds.length > 0) {
    await tx.subtask.updateMany({
      where: { id: { in: completeIds }, done: false },
      data: { done: true },
    });
  }

  if (completeTask) {
    await tx.task.updateMany({
      where: { id: taskId, done: false },
      data: { done: true },
    });
  }

  return { completedSubtaskIds, completedTask };
}