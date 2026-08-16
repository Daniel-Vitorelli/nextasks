import { NextResponse } from "next/server";

import { prisma } from "@/lib/server/prisma";
import {
  badRequest,
  notFound,
  parseTzOffset,
  requireUser,
} from "@/lib/server/api";
import {
  completeEntitiesForBlock,
  countConfirmedForConnection,
  type ConnectionWithBlock,
} from "@/lib/server/connections";
import { parseConnectionInput } from "@/lib/validation/connections";
import { localWeekday } from "@/lib/server/completions";
import type {
  ConnectionCatalogBlock,
  ConnectionsResponse,
  DayFilter,
  EventConfirmation,
  Frequency,
  TaskBlockConnection,
} from "@/types/domain";

async function toConnectionRow(
  connection: ConnectionWithBlock,
  tzOffsetMinutes: number,
): Promise<TaskBlockConnection> {
  return {
    id: connection.id,
    taskId: connection.taskId,
    subtaskId: connection.subtaskId,
    timeBlockId: connection.timeBlockId,
    requiredCount: connection.requiredCount,
    dayFilter: connection.dayFilter as DayFilter,
    confirmedCount: await countConfirmedForConnection(
      prisma,
      connection,
      tzOffsetMinutes,
    ),
  };
}

const connectionInclude = {
  timeBlock: { include: { routine: true } },
} as const;

export async function GET(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;

  const url = new URL(request.url);
  const tzOffsetMinutes = parseTzOffset(url.searchParams.get("tzOffset"));

  const [tasks, subtasks, blocks, connections] = await Promise.all([
    prisma.task.findMany({
      where: { userId: user.id },
      select: { id: true, title: true, done: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.subtask.findMany({
      where: { task: { userId: user.id } },
      select: {
        id: true,
        title: true,
        taskId: true,
        done: true,
        task: { select: { title: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.timeBlock.findMany({
      where: { routine: { userId: user.id } },
      include: { routine: { select: { id: true, name: true, frequency: true } } },
      orderBy: { start: "asc" },
    }),
    prisma.taskBlockConnection.findMany({
      where: { userId: user.id },
      include: connectionInclude,
    }),
  ]);

  const catalogBlocks: ConnectionCatalogBlock[] = blocks.map((block) => ({
    id: block.id,
    title: block.title,
    routineId: block.routine.id,
    routineName: block.routine.name,
    frequency: block.routine.frequency as Frequency,
    confirmation: block.confirmation as EventConfirmation,
    weekday: localWeekday(block.start, tzOffsetMinutes),
  }));

  const connectionRows = await Promise.all(
    connections.map((connection) =>
      toConnectionRow(connection, tzOffsetMinutes),
    ),
  );

  const result: ConnectionsResponse = {
    tasks,
    subtasks: subtasks.map((subtask) => ({
      id: subtask.id,
      title: subtask.title,
      taskId: subtask.taskId,
      taskTitle: subtask.task.title,
      done: subtask.done,
    })),
    blocks: catalogBlocks,
    connections: connectionRows,
  };

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;

  const input = parseConnectionInput(await request.json().catch(() => null));
  if (!input) {
    return badRequest("Invalid connection");
  }

  const url = new URL(request.url);
  const tzOffsetMinutes = parseTzOffset(url.searchParams.get("tzOffset"));

  const timeBlock = await prisma.timeBlock.findFirst({
    where: { id: input.timeBlockId, routine: { userId: user.id } },
  });
  if (!timeBlock) {
    return notFound("Time block not found");
  }

  if (input.taskId) {
    const task = await prisma.task.findFirst({
      where: { id: input.taskId, userId: user.id },
    });
    if (!task) {
      return notFound("Task not found");
    }
  }

  if (input.subtaskId) {
    const subtask = await prisma.subtask.findFirst({
      where: { id: input.subtaskId, task: { userId: user.id } },
    });
    if (!subtask) {
      return notFound("Subtask not found");
    }
  }

  const existing = await prisma.taskBlockConnection.findFirst({
    where: input.taskId
      ? { taskId: input.taskId, timeBlockId: input.timeBlockId }
      : { subtaskId: input.subtaskId, timeBlockId: input.timeBlockId },
  });
  if (existing) {
    return badRequest("Connection already exists");
  }

  const created = await prisma.$transaction(async (tx) => {
    const connection = await tx.taskBlockConnection.create({
      data: {
        userId: user.id,
        taskId: input.taskId,
        subtaskId: input.subtaskId,
        timeBlockId: input.timeBlockId,
        requiredCount: input.requiredCount,
        dayFilter: input.dayFilter,
      },
      include: connectionInclude,
    });

    // Conexão criada já satisfeita (bloco confirmado historicamente)?
    // Propaga a conclusão para a entidade conectada.
    await completeEntitiesForBlock(tx, user.id, input.timeBlockId, tzOffsetMinutes);

    return connection;
  });

  return NextResponse.json(
    { connection: await toConnectionRow(created, tzOffsetMinutes) },
    { status: 201 },
  );
}