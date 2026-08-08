import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { parseTimeBlockInput } from "@/lib/time-blocks";
import { getUser } from "@/lib/session";

const unauthorized = () =>
  NextResponse.json({ error: "Unauthorized" }, { status: 401 });

const notFound = () =>
  NextResponse.json({ error: "Routine not found" }, { status: 404 });

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteContext) {
  const user = await getUser();

  if (!user) {
    return unauthorized();
  }

  const { id } = await params;

  const routine = await prisma.routine.findFirst({
    where: { id, userId: user.id },
  });

  if (!routine) {
    return notFound();
  }

  const timeBlocks = await prisma.timeBlock.findMany({
    where: { routineId: id },
    orderBy: { start: "asc" },
  });

  return NextResponse.json(timeBlocks);
}

export async function POST(request: Request, { params }: RouteContext) {
  const user = await getUser();

  if (!user) {
    return unauthorized();
  }

  const { id } = await params;

  const routine = await prisma.routine.findFirst({
    where: { id, userId: user.id },
  });

  if (!routine) {
    return notFound();
  }

  const payload = parseTimeBlockInput(await request.json());

  if (!payload) {
    return NextResponse.json({ error: "Invalid time block" }, { status: 400 });
  }

  const timeBlock = await prisma.timeBlock.create({
    data: {
      routineId: id,
      ...payload,
    },
  });

  return NextResponse.json(timeBlock, { status: 201 });
}