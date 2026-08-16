import type {
  ConnectionInput,
  ConnectionPatch,
  DayFilter,
} from "@/types/domain";

const DAY_FILTER_PATTERN = /^(all|weekday:[0-6]|date:\d{4}-\d{2}-\d{2})$/;

function isValidDateString(value: string): boolean {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** Valida um dayFilter: "all", "weekday:N" (0-6) ou "date:YYYY-MM-DD". */
export function parseDayFilter(value: unknown): DayFilter | null {
  if (typeof value !== "string" || !DAY_FILTER_PATTERN.test(value)) {
    return null;
  }
  if (value === "all") return value;
  if (value.startsWith("weekday:")) return value as DayFilter;
  if (isValidDateString(value.slice("date:".length))) return value as DayFilter;
  return null;
}

function parseRequiredCount(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  if (value < 1 || value > 99) return null;
  return value;
}

export function parseConnectionInput(value: unknown): ConnectionInput | null {
  const body = (value ?? {}) as Record<string, unknown>;

  const hasTask = typeof body.taskId === "string" && body.taskId.trim() !== "";
  const hasSubtask =
    typeof body.subtaskId === "string" && body.subtaskId.trim() !== "";
  if (hasTask === hasSubtask) return null;

  if (typeof body.timeBlockId !== "string" || body.timeBlockId.trim() === "") {
    return null;
  }

  const requiredCount = parseRequiredCount(
    body.requiredCount ?? 1,
  );
  if (!requiredCount) return null;

  const dayFilter = parseDayFilter(body.dayFilter ?? "all");
  if (!dayFilter) return null;

  return {
    taskId: hasTask ? body.taskId as string : null,
    subtaskId: hasSubtask ? body.subtaskId as string : null,
    timeBlockId: body.timeBlockId,
    requiredCount,
    dayFilter,
  };
}

export function parseConnectionPatch(value: unknown): ConnectionPatch | null {
  const body = (value ?? {}) as Record<string, unknown>;
  const patch: ConnectionPatch = {};

  if (body.requiredCount !== undefined) {
    const requiredCount = parseRequiredCount(body.requiredCount);
    if (!requiredCount) return null;
    patch.requiredCount = requiredCount;
  }

  if (body.dayFilter !== undefined) {
    const dayFilter = parseDayFilter(body.dayFilter);
    if (!dayFilter) return null;
    patch.dayFilter = dayFilter;
  }

  if (patch.requiredCount === undefined && patch.dayFilter === undefined) {
    return null;
  }

  return patch;
}