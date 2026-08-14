import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/session";

const unauthorized = () =>
  NextResponse.json({ error: "Unauthorized" }, { status: 401 });

const notFound = () =>
  NextResponse.json({ error: "Routine not found" }, { status: 404 });

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Marks a routine as active/inactive. Only one routine can be active per
 * user at a time: activating one deactivates all the others in the same
 * transaction.
 */
export async function POST(request: Request, { params }: RouteContext) {
  const user = await getUser();

  if (!user) {
    return unauthorized();
  }

  const { id } = await params;

  const existing = await prisma.routine.findFirst({
    where: { id, userId: user.id },
  });

  if (!existing) {
    return notFound();
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