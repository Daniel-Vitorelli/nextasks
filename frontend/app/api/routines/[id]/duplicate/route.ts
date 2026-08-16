import { NextResponse } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { notFound, requireUser, type RouteContext } from "@/lib/server/api";

/**
 * Duplicates a routine (including all of its time blocks) as a fresh,
 * inactive copy. The copy name may be overridden by the client so it can be
 * localized (e.g. "Routine (copy)" / "Rotina (cópia)").
 */
export async function POST(
  request: Request,
  { params }: RouteContext<{ id: string }>,
) {
  const { user, response } = await requireUser();
  if (response) return response;

  const { id } = await params;

  const source = await prisma.routine.findFirst({
    where: { id, userId: user.id },
    include: { timeBlocks: true },
  });
  if (!source) {
    return notFound("Routine not found");
  }

  let requestedName: unknown;
  try {
    const body = await request.json();
    requestedName = (body as { name?: unknown }).name;
  } catch {
    requestedName = undefined;
  }

  const name =
    typeof requestedName === "string" && requestedName.trim()
      ? requestedName.trim()
      : source.name;

  const copy = await prisma.routine.create({
    data: {
      userId: user.id,
      name,
      description: source.description,
      frequency: source.frequency,
      duration: source.duration,
      endDate: source.endDate,
      isActive: false,
      timeBlocks: {
        create: source.timeBlocks.map((block) => ({
          title: block.title,
          description: block.description,
          start: block.start,
          end: block.end,
          isAllDay: block.isAllDay,
          color: block.color,
          confirmation: block.confirmation,
        })),
      },
    },
  });

  return NextResponse.json(copy, { status: 201 });
}
