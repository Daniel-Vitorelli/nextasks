import { NextResponse } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { parseHabitPatch } from "@/lib/validation/habits";
import { notFound, parseTzOffset, requireUser } from "@/lib/server/api";
import { reversePropagateForBlock } from "@/lib/server/connections";

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

  // Hábitos ruins não participam de conexões: ao virar ruim, remove as
  // conexões e as auto-confirmações que o hábito originou nos blocos.
  const tzOffset = parseTzOffset(
    new URL(request.url).searchParams.get("tzOffset"),
  );
  if (result.data.type === "bad" && habit.type !== "bad") {
    await prisma.$transaction(async (tx) => {
      const autos = await tx.timeBlockCompletion.findMany({
        where: { source: "auto", sourceEntityId: `habit:${id}` },
        select: { timeBlockId: true },
      });
      await tx.timeBlockCompletion.deleteMany({
        where: { source: "auto", sourceEntityId: `habit:${id}` },
      });
      await tx.taskBlockConnection.deleteMany({ where: { habitId: id } });
      for (const timeBlockId of [
        ...new Set(autos.map((auto) => auto.timeBlockId)),
      ]) {
        await reversePropagateForBlock(tx, user.id, timeBlockId, tzOffset);
      }
    });
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

  // A exclusão em cascata remove conexões e conclusões, mas as auto-
  // confirmações que o hábito gerou em blocos ficariam órfãs: remove-as e
  // reavalia as entidades conectadas a cada bloco afetado.
  const tzOffset = parseTzOffset(
    new URL(_request.url).searchParams.get("tzOffset"),
  );
  await prisma.$transaction(async (tx) => {
    const autos = await tx.timeBlockCompletion.findMany({
      where: { source: "auto", sourceEntityId: `habit:${id}` },
      select: { timeBlockId: true },
    });
    if (autos.length > 0) {
      await tx.timeBlockCompletion.deleteMany({
        where: { source: "auto", sourceEntityId: `habit:${id}` },
      });
      for (const timeBlockId of [
        ...new Set(autos.map((auto) => auto.timeBlockId)),
      ]) {
        await reversePropagateForBlock(tx, user.id, timeBlockId, tzOffset);
      }
    }
    await prisma.habit.delete({ where: { id } });
  });

  return NextResponse.json({ ok: true });
}