import { NextResponse } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { parseTimeBlockPatch } from "@/lib/validation/time-blocks";
import { badRequest, notFound, requireUser, type RouteContext } from "@/lib/server/api";

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

  // Desligar a confirmação com conexões ativas criaria conexões impossíveis
  // de satisfazer (nunca confirmáveis).
  if (patch.confirmation === "none") {
    const connections = await prisma.taskBlockConnection.count({
      where: { timeBlockId: blockId },
    });
    if (connections > 0) {
      return badRequest("Block has connections; remove them first");
    }
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
