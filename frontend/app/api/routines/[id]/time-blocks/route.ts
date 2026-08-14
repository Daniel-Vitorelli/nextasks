import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { parseTimeBlockInput } from "@/lib/time-blocks";
import { badRequest, notFound, requireUser, type RouteContext } from "@/lib/api";

async function getOwnedRoutine(id: string, userId: string) {
  return prisma.routine.findFirst({
    where: { id, userId },
  });
}

export async function GET(
  _request: Request,
  { params }: RouteContext<{ id: string }>,
) {
  const { user, response } = await requireUser();
  if (response) return response;

  const { id } = await params;

  const routine = await getOwnedRoutine(id, user.id);
  if (!routine) {
    return notFound("Routine not found");
  }

  const timeBlocks = await prisma.timeBlock.findMany({
    where: { routineId: id },
    orderBy: { start: "asc" },
  });

  return NextResponse.json(timeBlocks);
}

export async function POST(
  request: Request,
  { params }: RouteContext<{ id: string }>,
) {
  const { user, response } = await requireUser();
  if (response) return response;

  const { id } = await params;

  const routine = await getOwnedRoutine(id, user.id);
  if (!routine) {
    return notFound("Routine not found");
  }

  const payload = parseTimeBlockInput(await request.json());
  if (!payload) {
    return badRequest("Invalid time block");
  }

  const timeBlock = await prisma.timeBlock.create({
    data: {
      routineId: id,
      ...payload,
    },
  });

  return NextResponse.json(timeBlock, { status: 201 });
}
