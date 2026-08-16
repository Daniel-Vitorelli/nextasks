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
import { confirmBlocksForDoneEntities } from "@/lib/server/connections";

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
        await markTaskDoneCascade(tx, id);

      if (taskCompleted || completedSubtaskIds.length > 0) {
        await confirmBlocksForDoneEntities(
          tx,
          taskCompleted ? [id] : [],
          completedSubtaskIds,
          tzOffsetMinutes,
        );
      }
    }

    return updated;
  });

  return NextResponse.json(task);
}

export async function DELETE(
  _request: Request,
  { params }: RouteContext<{ id: string }>,
) {
  const { user, response } = await requireUser();
  if (response) return response;

  const { id } = await params;

  const existing = await getOwnedTask(id, user.id);
  if (!existing) {
    return notFound("Task not found");
  }

  await prisma.task.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}