import { NextResponse } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { notFound, requireUser, type RouteContext } from "@/lib/server/api";

/**
 * Marks a routine as active/inactive. Only one routine can be active per
 * user at a time: activating one deactivates all the others in the same
 * transaction.
 */
export async function POST(
  request: Request,
  { params }: RouteContext<{ id: string }>,
) {
  const { user, response } = await requireUser();
  if (response) return response;

  const { id } = await params;

  const existing = await prisma.routine.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) {
    return notFound("Routine not found");
  }

  const body = (await request.json()) as { isActive?: unknown };
  const isActive = body.isActive === true;

  let routine;
  if (isActive) {
    const [, updated] = await prisma.$transaction([
      prisma.routine.updateMany({
        where: { userId: user.id, isActive: true },
        data: { isActive: false },
      }),
      prisma.routine.update({
        where: { id },
        data: { isActive: true },
      }),
    ]);
    routine = updated;
  } else {
    routine = await prisma.routine.update({
      where: { id },
      data: { isActive: false },
    });
  }

  return NextResponse.json(routine);
}
