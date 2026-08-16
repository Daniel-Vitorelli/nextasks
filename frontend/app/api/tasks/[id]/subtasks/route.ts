import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { parseSubtaskInput } from "@/lib/validation/subtasks";
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

  const subtask = await prisma.$transaction(async (tx) => {
    const created = await tx.subtask.create({
      data: {
        taskId: id,
        parentId,
        ...payload,
      },
    });

    // Criar uma sub-tarefa não concluída sob um pai/tarefa concluídos quebra
    // a invariante "pai só fica feito se todos os filhos estiverem feitos":
    // reabre a cadeia de ancestrais e a tarefa, se estiverem feitos.
    if (parentId || task.done) {
      const siblings = await tx.subtask.findMany({
        where: { taskId: id },
        select: { id: true, parentId: true },
      });
      const parentById = new Map(
        siblings.map((item) => [item.id, item.parentId]),
      );
      const ancestorIds: string[] = [];
      let currentId = parentId;
      while (currentId) {
        ancestorIds.push(currentId);
        currentId = parentById.get(currentId) ?? null;
      }
      if (ancestorIds.length > 0) {
        await tx.subtask.updateMany({
          where: { id: { in: ancestorIds }, done: true },
          data: { done: false },
        });
      }
      if (task.done) {
        await tx.task.update({
          where: { id },
          data: { done: false },
        });
      }
    }

    return created;
  });

  return NextResponse.json(subtask, { status: 201 });
}