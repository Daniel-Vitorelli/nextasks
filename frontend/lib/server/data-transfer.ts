import { randomUUID } from "crypto";

import { prisma } from "@/lib/server/prisma";
import type {
  DataExport,
  ImportResult,
} from "@/types/domain";

/**
 * Exporta/importa os dados do usuário (rotinas, blocos, tarefas, sub-tarefas,
 * conexões e confirmações) como JSON.
 *
 * Só o necessário para reconstruir o estado é exportado: ids originais apenas
 * como chaves de referência (a importação gera ids novos), timestamps apenas
 * quando consumidos por alguma lógica (rotina/tarefa/sub-tarefa/conexão
 * ordenam ou limitam por `createdAt`; confirmações usam `updatedAt` na
 * contagem de conexões).
 *
 * A importação recria as entidades com ids novos (UUIDs aleatórios), sem
 * sobrescrever nada existente.
 */

const EXPORT_VERSION = 1;

/** Descrições vazias não são informação: exporta como null. */
function textOrNull(value: string | null): string | null {
  return value && value.trim().length > 0 ? value : null;
}

export async function buildDataExport(userId: string): Promise<DataExport> {
  const [
    routines,
    timeBlocks,
    tasks,
    subtasks,
    connections,
    completions,
    habits,
    habitCompletions,
  ] = await Promise.all([
    prisma.routine.findMany({ where: { userId } }),
    prisma.timeBlock.findMany({
      where: { routine: { userId } },
    }),
    prisma.task.findMany({ where: { userId } }),
    prisma.subtask.findMany({
      where: { task: { userId } },
    }),
    prisma.taskBlockConnection.findMany({ where: { userId } }),
    prisma.timeBlockCompletion.findMany({ where: { userId } }),
    prisma.habit.findMany({ where: { userId } }),
    prisma.habitCompletion.findMany({ where: { userId } }),
  ]);

  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    routines: routines.map((row) => ({
      id: row.id,
      name: row.name,
      description: textOrNull(row.description),
      frequency: row.frequency as DataExport["routines"][number]["frequency"],
      duration: row.duration as DataExport["routines"][number]["duration"],
      endDate: row.endDate?.toISOString() ?? null,
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
    })),
    timeBlocks: timeBlocks.map((row) => ({
      id: row.id,
      routineId: row.routineId,
      title: row.title,
      description: textOrNull(row.description),
      start: row.start.toISOString(),
      end: row.end.toISOString(),
      isAllDay: row.isAllDay,
      color: row.color as DataExport["timeBlocks"][number]["color"],
      confirmation:
        row.confirmation as DataExport["timeBlocks"][number]["confirmation"],
    })),
    tasks: tasks.map((row) => ({
      id: row.id,
      title: row.title,
      description: textOrNull(row.description),
      dueDate: row.dueDate?.toISOString() ?? null,
      priority: row.priority,
      done: row.done,
      createdAt: row.createdAt.toISOString(),
    })),
    subtasks: subtasks.map((row) => ({
      id: row.id,
      taskId: row.taskId,
      parentId: row.parentId,
      title: row.title,
      description: textOrNull(row.description),
      done: row.done,
      createdAt: row.createdAt.toISOString(),
    })),
    connections: connections.map((row) => ({
      taskId: row.taskId,
      subtaskId: row.subtaskId,
      timeBlockId: row.timeBlockId,
      requiredCount: row.requiredCount,
      dayFilter: row.dayFilter as DataExport["connections"][number]["dayFilter"],
      createdAt: row.createdAt.toISOString(),
    })),
    completions: completions.map((row) => ({
      timeBlockId: row.timeBlockId,
      periodStart: row.periodStart.toISOString(),
      periodEnd: row.periodEnd.toISOString(),
      value: row.value,
      source: row.source,
      sourceEntityId: row.sourceEntityId,
      updatedAt: row.updatedAt.toISOString(),
    })),
    habits: habits.map((row) => ({
      id: row.id,
      name: row.name,
      description: textOrNull(row.description),
      icon: row.icon,
      color: row.color as DataExport["habits"][number]["color"],
      type: row.type as DataExport["habits"][number]["type"],
      frequency: row.frequency as DataExport["habits"][number]["frequency"],
      daysOfWeek: row.daysOfWeek,
      targetCount: row.targetCount,
    })),
    habitCompletions: habitCompletions.map((row) => ({
      habitId: row.habitId,
      date: row.date.toISOString(),
      count: row.count,
    })),
  };
}

function remapSourceEntityId(
  sourceEntityId: string | null,
  taskIds: Map<string, string>,
  subtaskIds: Map<string, string>,
): string | null {
  if (!sourceEntityId) return null;
  const [kind, id] = sourceEntityId.split(":", 2);
  if (!id) return null;
  const mapped =
    kind === "task"
      ? taskIds.get(id)
      : kind === "subtask"
        ? subtaskIds.get(id)
        : undefined;
  return mapped ? `${kind}:${mapped}` : null;
}

export async function importDataExport(
  userId: string,
  payload: DataExport,
): Promise<ImportResult> {
  return prisma.$transaction(async (tx) => {
    const routineIds = new Map<string, string>();
    for (const routine of payload.routines) {
      const id = randomUUID();
      routineIds.set(routine.id, id);
      await tx.routine.create({
        data: {
          id,
          userId,
          name: routine.name,
          description: routine.description,
          frequency: routine.frequency,
          duration: routine.duration,
          endDate: routine.endDate ? new Date(routine.endDate) : null,
          isActive: routine.isActive,
          createdAt: new Date(routine.createdAt),
        },
      });
    }

    const timeBlockIds = new Map<string, string>();
    for (const block of payload.timeBlocks) {
      const id = randomUUID();
      const routineId = routineIds.get(block.routineId);
      if (!routineId) throw new Error("Routine reference not found");
      timeBlockIds.set(block.id, id);
      await tx.timeBlock.create({
        data: {
          id,
          routineId,
          title: block.title,
          description: block.description,
          start: new Date(block.start),
          end: new Date(block.end),
          isAllDay: block.isAllDay,
          color: block.color,
          confirmation: block.confirmation,
        },
      });
    }

    const taskIds = new Map<string, string>();
    for (const task of payload.tasks) {
      const id = randomUUID();
      taskIds.set(task.id, id);
      await tx.task.create({
        data: {
          id,
          userId,
          title: task.title,
          description: task.description,
          dueDate: task.dueDate ? new Date(task.dueDate) : null,
          priority: task.priority,
          done: task.done,
          createdAt: new Date(task.createdAt),
        },
      });
    }

    const subtaskIds = new Map<string, string>();
    for (const subtask of payload.subtasks) {
      const id = randomUUID();
      const taskId = taskIds.get(subtask.taskId);
      if (!taskId) throw new Error("Task reference not found");
      subtaskIds.set(subtask.id, id);
      await tx.subtask.create({
        data: {
          id,
          taskId,
          // parentId é definido num segundo passe: a ordem do arquivo não
          // garante que o pai venha antes do filho.
          parentId: null,
          title: subtask.title,
          description: subtask.description,
          done: subtask.done,
          createdAt: new Date(subtask.createdAt),
        },
      });
    }

    for (const subtask of payload.subtasks) {
      if (!subtask.parentId) continue;
      const id = subtaskIds.get(subtask.id);
      const parentId = subtaskIds.get(subtask.parentId);
      if (!id || !parentId) throw new Error("Subtask reference not found");
      await tx.subtask.update({
        where: { id },
        data: { parentId },
      });
    }

    for (const connection of payload.connections) {
      const timeBlockId = timeBlockIds.get(connection.timeBlockId);
      if (!timeBlockId) throw new Error("Time block reference not found");
      const taskId = connection.taskId
        ? taskIds.get(connection.taskId)
        : undefined;
      const subtaskId = connection.subtaskId
        ? subtaskIds.get(connection.subtaskId)
        : undefined;
      await tx.taskBlockConnection.create({
        data: {
          userId,
          taskId: taskId ?? null,
          subtaskId: subtaskId ?? null,
          timeBlockId,
          requiredCount: connection.requiredCount,
          dayFilter: connection.dayFilter,
          createdAt: new Date(connection.createdAt),
        },
      });
    }

    for (const completion of payload.completions) {
      const timeBlockId = timeBlockIds.get(completion.timeBlockId);
      if (!timeBlockId) throw new Error("Time block reference not found");
      await tx.timeBlockCompletion.create({
        data: {
          timeBlockId,
          userId,
          periodStart: new Date(completion.periodStart),
          periodEnd: new Date(completion.periodEnd),
          value: completion.value,
          source: completion.source,
          sourceEntityId: remapSourceEntityId(
            completion.sourceEntityId,
            taskIds,
            subtaskIds,
          ),
          updatedAt: new Date(completion.updatedAt),
        },
      });
    }

    const habitIds = new Map<string, string>();
    for (const habit of payload.habits) {
      const id = randomUUID();
      habitIds.set(habit.id, id);
      await tx.habit.create({
        data: {
          id,
          userId,
          name: habit.name,
          description: habit.description,
          icon: habit.icon,
          color: habit.color,
          type: habit.type,
          frequency: habit.frequency,
          daysOfWeek: habit.daysOfWeek,
          targetCount: habit.targetCount,
        },
      });
    }

    for (const completion of payload.habitCompletions) {
      const habitId = habitIds.get(completion.habitId);
      if (!habitId) throw new Error("Habit reference not found");
      await tx.habitCompletion.create({
        data: {
          habitId,
          userId,
          date: new Date(completion.date),
          count: completion.count,
        },
      });
    }

    return {
      routines: payload.routines.length,
      timeBlocks: payload.timeBlocks.length,
      tasks: payload.tasks.length,
      subtasks: payload.subtasks.length,
      connections: payload.connections.length,
      completions: payload.completions.length,
      habits: payload.habits.length,
      habitCompletions: payload.habitCompletions.length,
    };
  });
}