import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { parseRoutineInput } from "@/lib/routines";
import { getUser } from "@/lib/session";

const unauthorized = () =>
  NextResponse.json({ error: "Unauthorized" }, { status: 401 });

const notFound = () =>
  NextResponse.json({ error: "Routine not found" }, { status: 404 });

async function getOwnedRoutine(id: string, userId: string) {
  return prisma.routine.findFirst({
    where: { id, userId },
  });
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const user = await getUser();

  if (!user) {
    return unauthorized();
  }

  const { id } = await params;

  const existing = await getOwnedRoutine(id, user.id);

  if (!existing) {
    return notFound();
  }

  const result = parseRoutineInput(await request.json());

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const routine = await prisma.routine.update({
    where: { id },
    data: result.data,
  });

  return NextResponse.json(routine);
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const user = await getUser();

  if (!user) {
    return unauthorized();
  }

  const { id } = await params;

  const existing = await getOwnedRoutine(id, user.id);

  if (!existing) {
    return notFound();
  }

  await prisma.routine.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}