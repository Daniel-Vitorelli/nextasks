import { NextResponse } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { parseHabitPatch } from "@/lib/validation/habits";
import { requireUser } from "@/lib/server/api";
import { notFound } from "@/lib/server/api";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { user, response } = await requireUser();
  if (response) return response;

  const { id } = await params;

  const habit = await prisma.habit.findFirst({
    where: { id, userId: user.id },
  });

  if (!habit) {
    return notFound();
  }

  return NextResponse.json(habit);
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { user, response } = await requireUser();
  if (response) return response;

  const { id } = await params;

  const result = parseHabitPatch(await request.json());

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const habit = await prisma.habit.findFirst({
    where: { id, userId: user.id },
  });

  if (!habit) {
    return notFound();
  }

  const updated = await prisma.habit.update({
    where: { id },
    data: result.data,
  });

  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { user, response } = await requireUser();
  if (response) return response;

  const { id } = await params;

  const habit = await prisma.habit.findFirst({
    where: { id, userId: user.id },
  });

  if (!habit) {
    return notFound();
  }

  await prisma.habit.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}