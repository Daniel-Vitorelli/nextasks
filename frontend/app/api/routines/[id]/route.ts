import { NextResponse } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { parseRoutineInput } from "@/lib/validation/routines";
import { badRequest, notFound, requireUser, type RouteContext } from "@/lib/server/api";

async function getOwnedRoutine(id: string, userId: string) {
  return prisma.routine.findFirst({
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

  const existing = await getOwnedRoutine(id, user.id);
  if (!existing) {
    return notFound("Routine not found");
  }

  const result = parseRoutineInput(await request.json());
  if (!result.ok) {
    return badRequest(result.error);
  }

  const routine = await prisma.routine.update({
    where: { id },
    data: result.data,
  });

  return NextResponse.json(routine);
}

export async function DELETE(
  _request: Request,
  { params }: RouteContext<{ id: string }>,
) {
  const { user, response } = await requireUser();
  if (response) return response;

  const { id } = await params;

  const existing = await getOwnedRoutine(id, user.id);
  if (!existing) {
    return notFound("Routine not found");
  }

  await prisma.routine.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
