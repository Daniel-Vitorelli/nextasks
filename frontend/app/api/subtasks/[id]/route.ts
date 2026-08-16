import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { parseSubtaskPatch } from "@/lib/subtasks";
import { badRequest, notFound, requireUser, type RouteContext } from "@/lib/api";

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

  const subtask = await prisma.subtask.update({
    where: { id },
    data: patch,
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

  // Exclui a sub-tarefa e toda a sub-árvore abaixo dela (cascade).
  await prisma.subtask.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}