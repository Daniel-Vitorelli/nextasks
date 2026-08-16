import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { parseRoutineInput } from "@/lib/validation/routines";
import { requireUser } from "@/lib/api";

export async function GET() {
  const { user, response } = await requireUser();
  if (response) return response;

  const routines = await prisma.routine.findMany({
    where: { userId: user.id },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(routines);
}

export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;

  const result = parseRoutineInput(await request.json());

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const routine = await prisma.routine.create({
    data: {
      userId: user.id,
      ...result.data,
    },
  });

  return NextResponse.json(routine, { status: 201 });
}
