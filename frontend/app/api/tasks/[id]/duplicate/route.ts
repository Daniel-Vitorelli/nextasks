import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { notFound, requireUser, type RouteContext } from "@/lib/api";

/**
 * Duplicates a task as a fresh, incomplete copy. The copy title may be
 * overridden by the client so it can be localized (e.g. "Task (copy)").
 */
export async function POST(
  request: Request,
  { params }: RouteContext<{ id: string }>,
) {
  const { user, response } = await requireUser();
  if (response) return response;

  const { id } = await params;

  const source = await prisma.task.findFirst({
    where: { id, userId: user.id },
  });
  if (!source) {
    return notFound("Task not found");
  }

  let requestedTitle: unknown;
  try {
    const body = await request.json();
    requestedTitle = (body as { title?: unknown }).title;
  } catch {
    requestedTitle = undefined;
  }

  const title =
    typeof requestedTitle === "string" && requestedTitle.trim()
      ? requestedTitle.trim()
      : source.title;

  const copy = await prisma.task.create({
    data: {
      userId: user.id,
      title,
      description: source.description,
      dueDate: source.dueDate,
      priority: source.priority,
      done: false,
    },
  });

  return NextResponse.json(copy, { status: 201 });
}