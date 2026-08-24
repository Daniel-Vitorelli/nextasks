import type {
  DataExport,
  DataExportCompletion,
  DataExportConnection,
  DataExportHabit,
  DataExportHabitCompletion,
  DataExportRoutine,
  DataExportSubtask,
  DataExportTask,
  DataExportTimeBlock,
  Duration,
  EventColor,
  EventConfirmation,
  Frequency,
} from "@/types/domain";
import { CONFIRMATION_OPTIONS, EVENT_COLORS } from "@/lib/calendar/event-constants";
import { parseDayFilter } from "@/lib/validation/connections";

const EXPORT_VERSION = 1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown, maxLength: number): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length > maxLength) return null;
  return trimmed;
}

function requiredString(value: unknown, maxLength: number): string | null {
  const trimmed = optionalString(value, maxLength);
  return trimmed ? trimmed : null;
}

function optionalDate(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return null;
  return value;
}

function requiredDate(value: unknown): string | null {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return null;
  return value;
}

function optionalBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function parseRoutine(value: unknown): DataExportRoutine | null {
  if (!isRecord(value)) return null;
  const name = requiredString(value.name, 100);
  if (!name) return null;

  const frequency: Frequency = value.frequency === "weekly" ? "weekly" : "daily";
  const duration: Duration =
    value.duration === "until" ? "until" : "indefinite";

  const endDate = optionalDate(value.endDate);
  if (value.endDate !== undefined && value.endDate !== null && !endDate) {
    return null;
  }
  const createdAt = requiredDate(value.createdAt);
  if (!createdAt) return null;

  return {
    id: requiredString(value.id, 100) ?? "",
    name,
    description: optionalString(value.description, 2000),
    frequency,
    duration,
    endDate,
    isActive: optionalBoolean(value.isActive, false),
    createdAt,
  };
}

function parseTimeBlock(value: unknown): DataExportTimeBlock | null {
  if (!isRecord(value)) return null;
  const title = requiredString(value.title, 200);
  const start = requiredDate(value.start);
  const end = requiredDate(value.end);
  if (!title || !start || !end) return null;

  const color: EventColor = EVENT_COLORS.includes(value.color as EventColor)
    ? (value.color as EventColor)
    : "green";
  const confirmation: EventConfirmation = CONFIRMATION_OPTIONS.includes(
    value.confirmation as EventConfirmation,
  )
    ? (value.confirmation as EventConfirmation)
    : "none";

  const isAllDay = optionalBoolean(value.isAllDay, false);
  if (Date.parse(end) < Date.parse(start)) return null;

  return {
    id: requiredString(value.id, 100) ?? "",
    routineId: requiredString(value.routineId, 100) ?? "",
    title,
    description: optionalString(value.description, 2000),
    start,
    end,
    isAllDay,
    color,
    confirmation,
  };
}

function parseTask(value: unknown): DataExportTask | null {
  if (!isRecord(value)) return null;
  const title = requiredString(value.title, 200);
  if (!title) return null;

  const priority =
    typeof value.priority === "number" &&
    Number.isInteger(value.priority) &&
    value.priority >= 1 &&
    value.priority <= 6
      ? value.priority
      : 3;

  const dueDate = optionalDate(value.dueDate);
  if (value.dueDate !== undefined && value.dueDate !== null && !dueDate) {
    return null;
  }
  const createdAt = requiredDate(value.createdAt);
  if (!createdAt) return null;

  return {
    id: requiredString(value.id, 100) ?? "",
    title,
    description: optionalString(value.description, 2000),
    dueDate,
    priority,
    done: optionalBoolean(value.done, false),
    createdAt,
  };
}

function parseSubtask(value: unknown): DataExportSubtask | null {
  if (!isRecord(value)) return null;
  const title = requiredString(value.title, 200);
  if (!title) return null;

  const parentId = optionalString(value.parentId, 100);
  if (value.parentId !== undefined && value.parentId !== null && !parentId) {
    return null;
  }
  const createdAt = requiredDate(value.createdAt);
  if (!createdAt) return null;

  return {
    id: requiredString(value.id, 100) ?? "",
    taskId: requiredString(value.taskId, 100) ?? "",
    parentId,
    title,
    description: optionalString(value.description, 2000),
    done: optionalBoolean(value.done, false),
    createdAt,
  };
}

function parseConnection(value: unknown): DataExportConnection | null {
  if (!isRecord(value)) return null;
  const timeBlockId = requiredString(value.timeBlockId, 100);
  const taskId = optionalString(value.taskId, 100);
  const subtaskId = optionalString(value.subtaskId, 100);
  const hasTask = value.taskId !== undefined && value.taskId !== null;
  const hasSubtask = value.subtaskId !== undefined && value.subtaskId !== null;
  if (!timeBlockId || hasTask === hasSubtask) return null;

  const requiredCount =
    typeof value.requiredCount === "number" &&
    Number.isInteger(value.requiredCount) &&
    value.requiredCount >= 1 &&
    value.requiredCount <= 99
      ? value.requiredCount
      : 1;

  const dayFilter = parseDayFilter(value.dayFilter ?? "all");
  if (!dayFilter) return null;

  const createdAt = requiredDate(value.createdAt);
  if (!createdAt) return null;

  return {
    taskId,
    subtaskId,
    timeBlockId,
    requiredCount,
    dayFilter,
    createdAt,
  };
}

function parseCompletion(value: unknown): DataExportCompletion | null {
  if (!isRecord(value)) return null;
  const timeBlockId = requiredString(value.timeBlockId, 100);
  const periodStart = requiredDate(value.periodStart);
  const periodEnd = requiredDate(value.periodEnd);
  const valueStr = requiredString(value.value, 64);
  const updatedAt = requiredDate(value.updatedAt);
  if (!timeBlockId || !periodStart || !periodEnd || !valueStr || !updatedAt) {
    return null;
  }

  const source = value.source === "auto" ? "auto" : "explicit";
  const sourceEntityId =
    typeof value.sourceEntityId === "string" && value.sourceEntityId.length > 0
      ? value.sourceEntityId
      : null;

  return {
    timeBlockId,
    periodStart,
    periodEnd,
    value: valueStr,
    source,
    sourceEntityId,
    updatedAt,
  };
}

/**
 * Valida o payload de importação/exportação JSON. Garante a forma básica de
 * cada registro e que as referências entre entidades são resolvíveis dentro
 * do próprio arquivo. Retorna null se qualquer item for inválido.
 *
 * `habits`/`habitCompletions` são opcionais: backups antigos (v1) não os
 * incluíam e continuam importáveis.
 */
export function parseDataExport(value: unknown): DataExport | null {
  if (!isRecord(value) || value.version !== EXPORT_VERSION) return null;

  const arrays = {
    routines: value.routines,
    timeBlocks: value.timeBlocks,
    tasks: value.tasks,
    subtasks: value.subtasks,
    connections: value.connections,
    completions: value.completions,
  };

  for (const key of Object.keys(arrays)) {
    if (!Array.isArray(arrays[key as keyof typeof arrays])) return null;
  }

  const habitsRaw = Array.isArray(value.habits) ? value.habits : [];
  const habitCompletionsRaw = Array.isArray(value.habitCompletions)
    ? value.habitCompletions
    : [];

  const routines: DataExportRoutine[] = [];
  for (const item of arrays.routines as unknown[]) {
    const parsed = parseRoutine(item);
    if (!parsed) return null;
    routines.push(parsed);
  }

  const tasks: DataExportTask[] = [];
  for (const item of arrays.tasks as unknown[]) {
    const parsed = parseTask(item);
    if (!parsed) return null;
    tasks.push(parsed);
  }

  const taskIds = new Set(tasks.map((task) => task.id));
  const subtasks: DataExportSubtask[] = [];
  const subtaskIds = new Set<string>();
  for (const item of arrays.subtasks as unknown[]) {
    const parsed = parseSubtask(item);
    if (!parsed) return null;
    if (!taskIds.has(parsed.taskId)) return null;
    if (parsed.parentId && parsed.parentId === parsed.id) return null;
    subtasks.push(parsed);
    subtaskIds.add(parsed.id);
  }
  for (const subtask of subtasks) {
    if (subtask.parentId && !subtaskIds.has(subtask.parentId)) return null;
  }

  const routineIds = new Set(routines.map((routine) => routine.id));
  const timeBlocks: DataExportTimeBlock[] = [];
  const timeBlockIds = new Set<string>();
  for (const item of arrays.timeBlocks as unknown[]) {
    const parsed = parseTimeBlock(item);
    if (!parsed) return null;
    if (!routineIds.has(parsed.routineId)) return null;
    timeBlocks.push(parsed);
    timeBlockIds.add(parsed.id);
  }

  const connections: DataExportConnection[] = [];
  for (const item of arrays.connections as unknown[]) {
    const parsed = parseConnection(item);
    if (!parsed) return null;
    if (!timeBlockIds.has(parsed.timeBlockId)) return null;
    if (parsed.taskId && !taskIds.has(parsed.taskId)) return null;
    if (parsed.subtaskId && !subtaskIds.has(parsed.subtaskId)) return null;
    connections.push(parsed);
  }

  const completions: DataExportCompletion[] = [];
  for (const item of arrays.completions as unknown[]) {
    const parsed = parseCompletion(item);
    if (!parsed) return null;
    if (!timeBlockIds.has(parsed.timeBlockId)) return null;
    completions.push(parsed);
  }

  const habits: DataExportHabit[] = [];
  const habitIds = new Set<string>();
  for (const item of habitsRaw) {
    const parsed = parseHabit(item);
    if (!parsed) return null;
    habits.push(parsed);
    habitIds.add(parsed.id);
  }

  const habitCompletions: DataExportHabitCompletion[] = [];
  for (const item of habitCompletionsRaw) {
    const parsed = parseHabitCompletion(item);
    if (!parsed) return null;
    if (!habitIds.has(parsed.habitId)) return null;
    habitCompletions.push(parsed);
  }

  return {
    version: EXPORT_VERSION,
    exportedAt:
      typeof value.exportedAt === "string" &&
      !Number.isNaN(Date.parse(value.exportedAt))
        ? value.exportedAt
        : new Date().toISOString(),
    routines,
    timeBlocks,
    tasks,
    subtasks,
    connections,
    completions,
    habits,
    habitCompletions,
  };
}

function parseHabit(value: unknown): DataExportHabit | null {
  if (!isRecord(value)) return null;
  const name = requiredString(value.name, 200);
  if (!name) return null;

  const frequency: DataExportHabit["frequency"] =
    value.frequency === "weekly" ? "weekly" : "daily";

  let daysOfWeek = "[]";
  if (typeof value.daysOfWeek === "string") {
    try {
      const parsed = JSON.parse(value.daysOfWeek);
      if (Array.isArray(parsed)) {
        daysOfWeek = JSON.stringify(
          parsed
            .map(Number)
            .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6),
        );
      }
    } catch {
      // Mantém "[]".
    }
  } else if (Array.isArray(value.daysOfWeek)) {
    daysOfWeek = JSON.stringify(
      value.daysOfWeek
        .map(Number)
        .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6),
    );
  }

  const targetCount =
    typeof value.targetCount === "number" &&
    Number.isInteger(value.targetCount) &&
    value.targetCount >= 1 &&
    value.targetCount <= 99
      ? value.targetCount
      : 1;

  const color: EventColor = EVENT_COLORS.includes(value.color as EventColor)
    ? (value.color as EventColor)
    : "green";

  const type: DataExportHabit["type"] = value.type === "bad" ? "bad" : "good";

  return {
    id: requiredString(value.id, 100) ?? "",
    name,
    description: optionalString(value.description, 2000),
    icon: requiredString(value.icon, 100) ?? "CheckCircle2",
    color,
    type,
    frequency,
    daysOfWeek,
    targetCount,
  };
}

function parseHabitCompletion(value: unknown): DataExportHabitCompletion | null {
  if (!isRecord(value)) return null;
  const habitId = requiredString(value.habitId, 100);
  const date = requiredDate(value.date);
  if (!habitId || !date) return null;

  const count =
    typeof value.count === "number" &&
    Number.isInteger(value.count) &&
    value.count >= 1 &&
    value.count <= 999
      ? value.count
      : 1;

  return { habitId, date, count };
}