import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { parseTaskInput } from "@/lib/tasks";
import { requireUser } from "@/lib/api";

export async function GET() {
  const { user, response } = await requireUser();
  if (response) return response;

  const tasks = await prisma.task.findMany({
    where: { userId: user.id },
    orderBy: [{ done: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(tasks);
}

export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;

  const payload = parseTaskInput(await request.json());
  if (!payload) {
    return NextResponse.json({ error: "Invalid task" }, { status: 400 });
  }

  const task = await prisma.task.create({
    data: {
      userId: user.id,
      ...payload,
    },
  });

  return NextResponse.json(task, { status: 201 });
}