import { NextResponse } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { parseSubtaskPatch } from "@/lib/validation/subtasks";
import {
  badRequest,
  notFound,
  parseTzOffset,
  requireUser,
  type RouteContext,
} from "@/lib/server/api";
import { markSubtaskDoneCascade } from "@/lib/server/subtask-cascade";
import {
  confirmBlocksForDoneEntities,
  reversePropagateForEntities,
} from "@/lib/server/connections";
import {
  awardXpOnce,
  removeXpByEntityPrefix,
  removeXpForRef,
  xpRefKeys,
} from "@/lib/server/gamification/xp";
import { XP_AMOUNTS } from "@/lib/gamification/rules";
import { evaluateAchievements } from "@/lib/server/gamification/service";
import { loadGamificationStats } from "@/lib/server/gamification/stats";
import { sendGamificationNotifications } from "@/lib/server/notifications/gamification-hooks";

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

  const url = new URL(request.url);
  const tzOffsetMinutes = parseTzOffset(url.searchParams.get("tzOffset"));

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

  // Reabrir quebra a invariante "pai só fica feito se todos os filhos
  // estiverem feitos": reabre a cadeia de ancestrais e a tarefa.
  const ancestorIds: string[] = [];
  if (patch.done === false) {
    let currentId = parentById.get(existing.id) ?? null;
    while (currentId) {
      ancestorIds.push(currentId);
      currentId = parentById.get(currentId) ?? null;
    }
  }

  const subtask = await prisma.$transaction(async (tx) => {
    const updated = await tx.subtask.update({
      where: { id },
      data: patch,
    });

    // Marcar como feita conclui toda a sub-árvore abaixo dela, sobe a cadeia
    // de ancestrais e, para as entidades que de fato transicionaram,
    // auto-confirma os blocos conectados no período atual.
    if (patch.done === true) {
      const { completedSubtaskIds, completedTask } =
        await markSubtaskDoneCascade(tx, existing.taskId, id, existing.done);

      if (completedTask || completedSubtaskIds.length > 0) {
        await confirmBlocksForDoneEntities(
          tx,
          completedTask ? [existing.taskId] : [],
          completedSubtaskIds,
          tzOffsetMinutes,
        );
      }

      // Gamificação: +XP por cada sub-tarefa recém-concluída (a própria e a
      // sub-árvore); tarefa completada pela cascata pontua na rota da tarefa.
      for (const subtaskId of completedSubtaskIds) {
        await awardXpOnce(
          tx,
          user.id,
          "subtask.done",
          XP_AMOUNTS.subtaskDone,
          xpRefKeys.subtaskDone(subtaskId),
        );
      }
      if (patch.done === true) {
        await awardXpOnce(
          tx,
          user.id,
          "subtask.done",
          XP_AMOUNTS.subtaskDone,
          xpRefKeys.subtaskDone(id),
        );
      }
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

    // Reabrir propaga no sentido reverso: remove as auto-confirmações das
    // entidades reabertas (nó, ancestrais e tarefa) e reavalia as entidades
    // conectadas aos mesmos blocos.
    if (patch.done === false) {
      await reversePropagateForEntities(
        tx,
        user.id,
        [
          { taskId: null, subtaskId: id },
          ...ancestorIds.map((ancestorId) => ({
            taskId: null as string | null,
            subtaskId: ancestorId,
          })),
          { taskId: existing.taskId, subtaskId: null },
        ],
        tzOffsetMinutes,
      );
      // Gamificação: reabrir remove o ganho do nó reaberto e dos ancestrais.
      await removeXpForRef(tx, user.id, "subtask.done", xpRefKeys.subtaskDone(id));
      for (const ancestorId of ancestorIds) {
        await removeXpForRef(
          tx,
          user.id,
          "subtask.done",
          xpRefKeys.subtaskDone(ancestorId),
        );
      }
    }

    const stats = await loadGamificationStats(tx, user.id, tzOffsetMinutes);
    const newlyUnlocked = await evaluateAchievements(tx, user.id, stats);

    return { updated, newlyUnlocked };
  });

  // Pushes de gamificação após o commit (conquistas + level up).
  await sendGamificationNotifications(user.id, {
    newlyUnlockedAchievements: subtask.newlyUnlocked,
  });

  return NextResponse.json(subtask.updated);
}

export async function DELETE(
  request: Request,
  { params }: RouteContext<{ id: string }>,
) {
  const { user, response } = await requireUser();
  if (response) return response;

  const { id } = await params;

  const url = new URL(request.url);
  const tzOffsetMinutes = parseTzOffset(url.searchParams.get("tzOffset"));

  const existing = await getOwnedSubtask(id, user.id);
  if (!existing) {
    return notFound("Subtask not found");
  }

  await prisma.$transaction(async (tx) => {
    // A exclusão remove toda a sub-árvore abaixo do nó (cascade): captura
    // os descendentes e os blocos conectados antes de excluir.
    const siblingsBefore = await tx.subtask.findMany({
      where: { taskId: existing.taskId },
      select: { id: true, parentId: true },
    });
    const childrenByParentBefore = new Map<string | null, string[]>();
    for (const sibling of siblingsBefore) {
      const children = childrenByParentBefore.get(sibling.parentId) ?? [];
      children.push(sibling.id);
      childrenByParentBefore.set(sibling.parentId, children);
    }
    const descendantIds: string[] = [];
    const stack = [...(childrenByParentBefore.get(existing.id) ?? [])];
    while (stack.length > 0) {
      const current = stack.pop()!;
      descendantIds.push(current);
      stack.push(...(childrenByParentBefore.get(current) ?? []));
    }
    const affectedEntityIds = [existing.id, ...descendantIds];

    const removedConnections = await tx.taskBlockConnection.findMany({
      where: { subtaskId: { in: affectedEntityIds } },
      select: { timeBlockId: true },
    });
    const removedBlockIds = [
      ...new Set(removedConnections.map((connection) => connection.timeBlockId)),
    ];

    // Exclui a sub-tarefa e toda a sub-árvore abaixo dela (cascade).
    await tx.subtask.delete({ where: { id } });

    // Gamificação: eventos das entidades excluídas saem do ledger.
    for (const entityId of affectedEntityIds) {
      await removeXpByEntityPrefix(tx, user.id, `subtask:${entityId}:`);
    }

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

    const taskDoneBefore = await tx.task.findUnique({
      where: { id: existing.taskId },
      select: { done: true },
    });

    const completeIds: string[] = [];
    let currentId = parentById.get(existing.id) ?? null;
    while (currentId) {
      if (doneById.get(currentId) === true) break;
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

    const taskTransitioned = completeTask && taskDoneBefore?.done === false;

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

    // Entidades que transicionaram para feitas devem auto-confirmar os blocos
    // conectados no periodo atual (mesma invariante do caminho done:true).
    if (taskTransitioned || completeIds.length > 0) {
      await confirmBlocksForDoneEntities(
        tx,
        taskTransitioned ? [existing.taskId] : [],
        completeIds,
        tzOffsetMinutes,
      );
    }

    // As entidades excluídas não existem mais: remove as auto-confirmações
    // que cada uma originou e reavalia as entidades conectadas aos blocos.
    await reversePropagateForEntities(
      tx,
      user.id,
      affectedEntityIds.map((subtaskId) => ({
        taskId: null as string | null,
        subtaskId,
      })),
      tzOffsetMinutes,
      removedBlockIds,
    );
  });

  return NextResponse.json({ ok: true });
}