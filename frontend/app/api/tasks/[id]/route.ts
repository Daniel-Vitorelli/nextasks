import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { parseTaskPatch } from "@/lib/tasks";
import { badRequest, notFound, requireUser, type RouteContext } from "@/lib/api";

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

  const task = await prisma.$transaction(async (tx) => {
    const updated = await tx.task.update({
      where: { id },
      data: patch,
    });

    // Marcar a tarefa como feita conclui todas as sub-tarefas dela.
    if (patch.done === true) {
      await tx.subtask.updateMany({
        where: { taskId: id, done: false },
        data: { done: true },
      });
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