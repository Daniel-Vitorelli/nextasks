import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { parseTimeBlockPatch } from "@/lib/time-blocks";
import { badRequest, notFound, requireUser, type RouteContext } from "@/lib/api";

async function getOwnedBlock(id: string, blockId: string, userId: string) {
  return prisma.timeBlock.findFirst({
    where: {
      id: blockId,
      routine: { id, userId },
    },
  });
}

export async function PATCH(
  request: Request,
  { params }: RouteContext<{ id: string; blockId: string }>,
) {
  const { user, response } = await requireUser();
  if (response) return response;

  const { id, blockId } = await params;

  const existing = await getOwnedBlock(id, blockId, user.id);
  if (!existing) {
    return notFound("Time block not found");
  }

  const patch = parseTimeBlockPatch(await request.json());
  if (!patch) {
    return badRequest("Invalid time block");
  }

  const timeBlock = await prisma.timeBlock.update({
    where: { id: blockId },
    data: patch,
  });

  return NextResponse.json(timeBlock);
}

export async function DELETE(
  _request: Request,
  { params }: RouteContext<{ id: string; blockId: string }>,
) {
  const { user, response } = await requireUser();
  if (response) return response;

  const { id, blockId } = await params;

  const existing = await getOwnedBlock(id, blockId, user.id);
  if (!existing) {
    return notFound("Time block not found");
  }

  await prisma.timeBlock.delete({ where: { id: blockId } });

  return NextResponse.json({ ok: true });
}
