import { NextResponse } from "next/server";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/server/prisma";
import {
  badRequest,
  notFound,
  parseTzOffset,
  requireUser,
} from "@/lib/server/api";
import {
  completeEntitiesForBlock,
  connectionInclude,
  isDayFilterSatisfiable,
  isRequiredCountReachable,
  loadCompletionsByBlock,
  reversePropagateForEntities,
  revertAutoHabitCompletionsForConnections,
  toConnectionRow,
} from "@/lib/server/connections";
import { localMinutesOfDay, localWeekday } from "@/lib/server/completions";
import { parseConnectionInput } from "@/lib/validation/connections";
import type {
  ConnectionCatalogBlock,
  ConnectionCatalogHabit,
  ConnectionsResponse,
  EventColor,
  EventConfirmation,
  Frequency,
} from "@/types/domain";

export async function GET(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;

  const url = new URL(request.url);
  const tzOffsetMinutes = parseTzOffset(url.searchParams.get("tzOffset"));

  const [tasks, subtasks, habits, blocks, connections] = await Promise.all([
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
    prisma.habit.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        name: true,
        type: true,
        color: true,
        icon: true,
        frequency: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.timeBlock.findMany({
      where: { routine: { userId: user.id } },
      include: {
        routine: { select: { id: true, name: true, frequency: true, isActive: true } },
      },
      orderBy: { start: "asc" },
    }),
    prisma.taskBlockConnection.findMany({
      where: { userId: user.id },
      include: connectionInclude,
    }),
  ]);

  const completionsByBlock = await loadCompletionsByBlock(prisma, connections);

  const catalogBlocks: ConnectionCatalogBlock[] = blocks.map((block) => ({
    id: block.id,
    title: block.title,
    routineId: block.routine.id,
    routineName: block.routine.name,
    frequency: block.routine.frequency as Frequency,
    confirmation: block.confirmation as EventConfirmation,
    color: block.color as EventColor,
    startMinutes: localMinutesOfDay(block.start, tzOffsetMinutes),
    weekday: localWeekday(block.start, tzOffsetMinutes),
    routineActive: block.routine.isActive,
  }));

  const result: ConnectionsResponse = {
    tasks,
    subtasks: subtasks.map((subtask) => ({
      id: subtask.id,
      title: subtask.title,
      taskId: subtask.taskId,
      taskTitle: subtask.task.title,
      done: subtask.done,
    })),
    habits: habits.map((habit) => ({
      id: habit.id,
      name: habit.name,
      type: habit.type as ConnectionCatalogHabit["type"],
      color: habit.color as EventColor,
      icon: habit.icon,
      frequency: habit.frequency as Frequency,
    })),
    blocks: catalogBlocks,
    connections: connections.map((connection) =>
      toConnectionRow(
        connection,
        completionsByBlock.get(connection.timeBlockId) ?? [],
        tzOffsetMinutes,
      ),
    ),
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
    include: { routine: { select: { frequency: true, isActive: true } } },
  });
  if (!timeBlock) {
    return notFound("Time block not found");
  }

  // Bloco sem modo de confirmação nunca pode satisfazer uma conexão.
  if (timeBlock.confirmation === "none") {
    return badRequest("Block has no confirmation mode");
  }

  // Rotinas inativas nunca geram confirmações: conexões para elas seriam mortas.
  if (!timeBlock.routine.isActive) {
    return badRequest("Routine is not active");
  }

  // A quantidade exigida precisa ser alcançável com o filtro.
  if (!isRequiredCountReachable(input.requiredCount, input.dayFilter)) {
    return badRequest("Required count is unreachable with this day filter");
  }

  // O dayFilter precisa ser possível de satisfazer para este bloco
  // (blocos semanais só ocorrem no próprio dia da semana).
  const blockWeekday = localWeekday(timeBlock.start, tzOffsetMinutes);
  if (
    !isDayFilterSatisfiable(
      input.dayFilter,
      timeBlock.routine.frequency as Frequency,
      blockWeekday,
    )
  ) {
    return badRequest("Day filter never matches this block");
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

  if (input.habitId) {
    const habit = await prisma.habit.findFirst({
      where: { id: input.habitId, userId: user.id },
    });
    if (!habit) {
      return notFound("Habit not found");
    }
    // Só hábitos bons participam de conexões (ruins têm lógica invertida).
    if (habit.type === "bad") {
      return badRequest("Only good habits can be connected");
    }
  }

  const existing = await prisma.taskBlockConnection.findFirst({
    where: input.taskId
      ? { taskId: input.taskId, timeBlockId: input.timeBlockId }
      : input.subtaskId
        ? { subtaskId: input.subtaskId, timeBlockId: input.timeBlockId }
        : { habitId: input.habitId, timeBlockId: input.timeBlockId },
  });
  if (existing) {
    return badRequest("Connection already exists");
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const connection = await tx.taskBlockConnection.create({
        data: {
          userId: user.id,
          taskId: input.taskId,
          subtaskId: input.subtaskId,
          habitId: input.habitId,
          timeBlockId: input.timeBlockId,
          requiredCount: input.requiredCount,
          dayFilter: input.dayFilter,
        },
        include: connectionInclude,
      });

      // Conexão criada já satisfeita (bloco confirmado historicamente)?
      // Propaga a conclusão para a entidade conectada.
      await completeEntitiesForBlock(
        tx,
        user.id,
        input.timeBlockId,
        tzOffsetMinutes,
      );

      // Conexão nova insatisfeita numa entidade já concluída: a entidade
      // deixa de cumprir "todas as conexões satisfeitas" e é reaberta.
      await reversePropagateForEntities(
        tx,
        user.id,
        [{ taskId: input.taskId, subtaskId: input.subtaskId }],
        tzOffsetMinutes,
      );
      if (input.habitId) {
        await revertAutoHabitCompletionsForConnections(
          tx,
          user.id,
          [input.habitId],
          tzOffsetMinutes,
        );
      }

      return connection;
    });

    const completionsByBlock = await loadCompletionsByBlock(prisma, [created]);

    return NextResponse.json(
      {
        connection: toConnectionRow(
          created,
          completionsByBlock.get(created.timeBlockId) ?? [],
          tzOffsetMinutes,
        ),
      },
      { status: 201 },
    );
  } catch (error) {
    // Unicidade também garantida no banco (@@unique taskId/subtaskId + bloco).
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return badRequest("Connection already exists");
    }
    throw error;
  }
}