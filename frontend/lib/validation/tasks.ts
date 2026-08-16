import type { TaskPatch, TaskPayload, TaskPriority } from "@/types/domain";
import { TASK_PRIORITIES } from "@/types/domain";
import { dateFromString, trimmedStringOrNull } from "./helpers";

export function parseTaskInput(value: unknown): TaskPayload | null {
  const body = (value ?? {}) as Record<string, unknown>;

  const title = trimmedStringOrNull(body.title);
  if (!title) return null;

  return {
    title,
    description: trimmedStringOrNull(body.description),
    dueDate: dateFromString(body.dueDate),
    priority: isTaskPriority(body.priority) ? body.priority : 3,
  };
}

export function parseTaskPatch(value: unknown): TaskPatch | null {
  const body = (value ?? {}) as Record<string, unknown>;
  const patch: TaskPatch = {};

  if (typeof body.title === "string") {
    const title = body.title.trim();
    if (!title) return null;
    patch.title = title;
  }

  if (typeof body.description === "string") {
    patch.description = body.description.trim() || null;
  }

  if (typeof body.dueDate === "string") {
    patch.dueDate = dateFromString(body.dueDate);
  }

  if (isTaskPriority(body.priority)) {
    patch.priority = body.priority;
  }

  if (typeof body.done === "boolean") {
    patch.done = body.done;
  }

  return patch;
}

function isTaskPriority(value: unknown): value is TaskPriority {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    TASK_PRIORITIES.includes(value as TaskPriority)
  );
}