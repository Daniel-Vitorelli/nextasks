import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { parseSubtaskInput } from "@/lib/subtasks";
import {
  badRequest,
  notFound,
  requireUser,
  type RouteContext,
} from "@/lib/api";
import type { Subtask } from "@/types/domain";

function buildTree(
  flat: {
    id: string;
    title: string;
    description: string | null;
    parentId: string | null;
    done: boolean;
  }[],
): Subtask[] {
  const nodes = new Map<string, Subtask>();
  for (const item of flat) {
    nodes.set(item.id, {
      id: item.id,
      title: item.title,
      description: item.description,
      parentId: item.parentId,
      done: item.done,
      children: [],
    });
  }

  const roots: Subtask[] = [];
  for (const node of nodes.values()) {
    if (node.parentId && nodes.has(node.parentId)) {
      nodes.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

export async function GET(
  _request: Request,
  { params }: RouteContext<{ id: string }>,
) {
  const { user, response } = await requireUser();
  if (response) return response;

  const { id } = await params;

  const task = await prisma.task.findFirst({
    where: { id, userId: user.id },
  });
  if (!task) {
    return notFound("Task not found");
  }

  const subtasks = await prisma.subtask.findMany({
    where: { taskId: id },
    orderBy: { createdAt: "asc" },
    select: { id: true, title: true, description: true, parentId: true, done: true },
  });

  return NextResponse.json(buildTree(subtasks));
}

export async function POST(
  request: Request,
  { params }: RouteContext<{ id: string }>,
) {
  const { user, response } = await requireUser();
  if (response) return response;

  const { id } = await params;

  const task = await prisma.task.findFirst({
    where: { id, userId: user.id },
  });
  if (!task) {
    return notFound("Task not found");
  }

  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const payload = parseSubtaskInput(body);
  if (!payload) {
    return badRequest("Invalid subtask");
  }

  let parentId: string | null = null;
  if (typeof body.parentId === "string" && body.parentId) {
    const parent = await prisma.subtask.findFirst({
      where: { id: body.parentId, taskId: id },
    });
    if (!parent) {
      return badRequest("Invalid parent subtask");
    }
    parentId = body.parentId;
  }

  const subtask = await prisma.subtask.create({
    data: {
      taskId: id,
      parentId,
      ...payload,
    },
  });

  return NextResponse.json(subtask, { status: 201 });
}