import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { parseRoutineInput } from "@/lib/routines";
import { getUser } from "@/lib/session";

const unauthorized = () =>
  NextResponse.json({ error: "Unauthorized" }, { status: 401 });

export async function GET() {
  const user = await getUser();

  if (!user) {
    return unauthorized();
  }

  const routines = await prisma.routine.findMany({
    where: { userId: user.id },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(routines);
}

export async function POST(request: Request) {
  const user = await getUser();

  if (!user) {
    return unauthorized();
  }

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