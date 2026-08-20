import { NextResponse } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { parseTaskPatch } from "@/lib/validation/tasks";
import {
  badRequest,
  notFound,
  parseTzOffset,
  requireUser,
  type RouteContext,
} from "@/lib/server/api";
import { markTaskDoneCascade } from "@/lib/server/subtask-cascade";
import {
  confirmBlocksForDoneEntities,
  reversePropagateForEntities,
} from "@/lib/server/connections";

async function getOwnedTask(id: string, userId: string) {
  return prisma.task.findFirst({
    where: { id, userId },
  });
}

export async function PATCH(
  request: Request,
  { params }: RouteContext<{ id: string }>,
) {
  const { user, response } = await requireUser();
  if (response) return response;

  const { id } = await params;

  const existing = await getOwnedTask(id, user.id);
  if (!existing) {
    return notFound("Task not found");
  }

  const patch = parseTaskPatch(await request.json());
  if (!patch) {
    return badRequest("Invalid task");
  }

  const url = new URL(request.url);
  const tzOffsetMinutes = parseTzOffset(url.searchParams.get("tzOffset"));

  const task = await prisma.$transaction(async (tx) => {
    const updated = await tx.task.update({
      where: { id },
      data: patch,
    });

    // Marcar a tarefa como feita conclui todas as sub-tarefas dela e, para
    // as entidades que de fato transicionaram, auto-confirma os blocos de
    // tempo conectados no período atual.
    if (patch.done === true) {
      const { completedSubtaskIds, taskCompleted } =
        await markTaskDoneCascade(tx, id, existing.done);

      if (taskCompleted || completedSubtaskIds.length > 0) {
        await confirmBlocksForDoneEntities(
          tx,
          taskCompleted ? [id] : [],
          completedSubtaskIds,
          tzOffsetMinutes,
        );
      }
    }

    // Reabrir a tarefa remove as auto-confirmações que ela originou e
    // reavalia as entidades conectadas aos mesmos blocos.
    if (patch.done === false) {
      await reversePropagateForEntities(
        tx,
        user.id,
        [{ taskId: id, subtaskId: null }],
        tzOffsetMinutes,
      );
    }

    return updated;
  });

  return NextResponse.json(task);
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

  const existing = await getOwnedTask(id, user.id);
  if (!existing) {
    return notFound("Task not found");
  }

  await prisma.$transaction(async (tx) => {
    // Sub-tarefas são removidas em cascata junto com a tarefa: suas
    // auto-confirmações também deixam de ser justificadas.
    const subtasks = await tx.subtask.findMany({
      where: { taskId: existing.id },
      select: { id: true },
    });
    const subtaskIds = subtasks.map((subtask) => subtask.id);

    // Blocos conectados à tarefa e às sub-tarefas: as conexões serão
    // removidas em cascata; os blocos ficam pendentes de reavaliação reversa.
    const removedConnections = await tx.taskBlockConnection.findMany({
      where: {
        OR: [
          { taskId: existing.id },
          ...(subtaskIds.length > 0 ? [{ subtaskId: { in: subtaskIds } }] : []),
        ],
      },
      select: { timeBlockId: true },
    });
    const removedBlockIds = [
      ...new Set(removedConnections.map((connection) => connection.timeBlockId)),
    ];

    await tx.task.delete({ where: { id } });

    // As entidades excluídas não existem mais: remove as auto-confirmações
    // que cada uma originou e reavalia as entidades conectadas aos blocos.
    await reversePropagateForEntities(
      tx,
      user.id,
      [
        { taskId: existing.id, subtaskId: null },
        ...subtaskIds.map((subtaskId) => ({
          taskId: null as string | null,
          subtaskId,
        })),
      ],
      tzOffsetMinutes,
      removedBlockIds,
    );
  });

  return NextResponse.json({ ok: true });
}