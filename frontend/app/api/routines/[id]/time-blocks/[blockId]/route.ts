import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { parseTimeBlockPatch } from "@/lib/time-blocks";
import { getUser } from "@/lib/session";

const unauthorized = () =>
  NextResponse.json({ error: "Unauthorized" }, { status: 401 });

const notFound = () =>
  NextResponse.json({ error: "Time block not found" }, { status: 404 });

interface RouteContext {
  params: Promise<{ id: string; blockId: string }>;
}

async function getOwnedBlock(id: string, blockId: string, userId: string) {
  return prisma.timeBlock.findFirst({
    where: {
      id: blockId,
      routine: { id, userId },
    },
  });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const user = await getUser();

  if (!user) {
    return unauthorized();
  }

  const { id, blockId } = await params;

  const existing = await getOwnedBlock(id, blockId, user.id);

  if (!existing) {
    return notFound();
  }

  const patch = parseTimeBlockPatch(await request.json());

  if (!patch) {
    return NextResponse.json({ error: "Invalid time block" }, { status: 400 });
  }

  const timeBlock = await prisma.timeBlock.update({
    where: { id: blockId },
    data: patch,
  });

  return NextResponse.json(timeBlock);
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const user = await getUser();

  if (!user) {
    return unauthorized();
  }

  const { id, blockId } = await params;

  const existing = await getOwnedBlock(id, blockId, user.id);

  if (!existing) {
    return notFound();
  }

  await prisma.timeBlock.delete({ where: { id: blockId } });

  return NextResponse.json({ ok: true });
}