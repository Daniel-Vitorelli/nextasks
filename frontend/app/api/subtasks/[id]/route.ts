import { NextResponse } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { parseSubtaskPatch } from "@/lib/validation/subtasks";
import { badRequest, notFound, requireUser, type RouteContext } from "@/lib/server/api";

async function getOwnedSubtask(id: string, userId: string) {
  return prisma.subtask.findFirst({
    where: { id, task: { userId } },
  });
}

export async function PATCH(
  request: Request,
  { params }: RouteContext<{ id: string }>,
) {
  const { user, response } = await requireUser();
  if (response) return response;

  const { id } = await params;

  const existing = await getOwnedSubtask(id, user.id);
  if (!existing) {
    return notFound("Subtask not found");
  }

  const patch = parseSubtaskPatch(await request.json());
  if (!patch) {
    return badRequest("Invalid subtask");
  }

  // Irmãos da mesma tarefa, para navegar entre descendentes e ancestrais.
  const siblings = await prisma.subtask.findMany({
    where: { taskId: existing.taskId },
    select: { id: true, parentId: true, done: true },
  });
  const childrenByParent = new Map<string | null, string[]>();
  const parentById = new Map<string, string | null>();
  for (const subtask of siblings) {
    const children = childrenByParent.get(subtask.parentId) ?? [];
    children.push(subtask.id);
    childrenByParent.set(subtask.parentId, children);
    parentById.set(subtask.id, subtask.parentId);
  }

  // Marcar como feita conclui toda a sub-árvore abaixo dela.
  let descendantIds: string[] = [];
  if (patch.done === true) {
    const stack = [...(childrenByParent.get(existing.id) ?? [])];
    while (stack.length > 0) {
      const current = stack.pop()!;
      descendantIds.push(current);
      stack.push(...(childrenByParent.get(current) ?? []));
    }
  }

  // Reabrir quebra a invariante "pai só fica feito se todos os filhos
  // estiverem feitos": reabre a cadeia de ancestrais e a tarefa.
  let ancestorIds: string[] = [];
  if (patch.done === false) {
    let currentId = parentById.get(existing.id) ?? null;
    while (currentId) {
      ancestorIds.push(currentId);
      currentId = parentById.get(currentId) ?? null;
    }
  }

  // Quando todos os filhos de um ancestral estiverem feitos, o ancestral
  // também fica feito (subindo a cadeia), assim como a tarefa.
  let completeIds: string[] = [];
  let completeTask = false;
  if (patch.done === true) {
    const doneById = new Map(siblings.map((item) => [item.id, item.done]));
    doneById.set(existing.id, true);
    for (const id of descendantIds) {
      doneById.set(id, true);
    }

    let currentId = parentById.get(existing.id) ?? null;
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
    completeTask =
      roots.length > 0 &&
      roots.every((root) => doneById.get(root) === true);
  }

  const subtask = await prisma.$transaction(async (tx) => {
    const updated = await tx.subtask.update({
      where: { id },
      data: patch,
    });

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
        where: { id: existing.taskId, done: false },
        data: { done: true },
      });
    }

    if (ancestorIds.length > 0) {
      await tx.subtask.updateMany({
        where: { id: { in: ancestorIds }, done: true },
        data: { done: false },
      });
    }

    // A tarefa só fica feita enquanto todas as sub-tarefas estiverem feitas.
    if (patch.done === false) {
      await tx.task.updateMany({
        where: { id: existing.taskId, done: true },
        data: { done: false },
      });
    }

    return updated;
  });

  return NextResponse.json(subtask);
}

export async function DELETE(
  _request: Request,
  { params }: RouteContext<{ id: string }>,
) {
  const { user, response } = await requireUser();
  if (response) return response;

  const { id } = await params;

  const existing = await getOwnedSubtask(id, user.id);
  if (!existing) {
    return notFound("Subtask not found");
  }

  await prisma.$transaction(async (tx) => {
    // Exclui a sub-tarefa e toda a sub-árvore abaixo dela (cascade).
    await tx.subtask.delete({ where: { id } });

    // Recalcula a conclusão dos ancestrais: se todos os filhos restantes
    // estiverem feitos (ou não restar nenhum), o ancestral volta a ficar
    // feito, subindo a cadeia até a tarefa.
    const siblings = await tx.subtask.findMany({
      where: { taskId: existing.taskId },
      select: { id: true, parentId: true, done: true },
    });
    const childrenByParent = new Map<string | null, string[]>();
    const parentById = new Map<string, string | null>();
    const doneById = new Map(siblings.map((item) => [item.id, item.done]));
    for (const subtask of siblings) {
      const children = childrenByParent.get(subtask.parentId) ?? [];
      children.push(subtask.id);
      childrenByParent.set(subtask.parentId, children);
      parentById.set(subtask.id, subtask.parentId);
    }

    const completeIds: string[] = [];
    let currentId = parentById.get(existing.id) ?? null;
    while (currentId) {
      const children = childrenByParent.get(currentId) ?? [];
      const allChildrenDone =
        children.length === 0 ||
        children.every((child) => doneById.get(child) === true);
      if (!allChildrenDone) break;
      completeIds.push(currentId);
      doneById.set(currentId, true);
      currentId = parentById.get(currentId) ?? null;
    }

    const roots = childrenByParent.get(null) ?? [];
    const completeTask =
      roots.length === 0 ||
      roots.every((root) => doneById.get(root) === true);

    if (completeIds.length > 0) {
      await tx.subtask.updateMany({
        where: { id: { in: completeIds }, done: false },
        data: { done: true },
      });
    }

    if (completeTask) {
      await tx.task.updateMany({
        where: { id: existing.taskId, done: false },
        data: { done: true },
      });
    }
  });

  return NextResponse.json({ ok: true });
}