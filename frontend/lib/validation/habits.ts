import type { EventColor, HabitPayload, HabitPatch } from "@/types/domain";
import { EVENT_COLORS } from "@/lib/calendar/event-constants";
import { trimmedStringOrNull } from "./helpers";

export const HABIT_FREQUENCIES = ["daily", "weekly"] as const;
export type HabitFrequency = (typeof HABIT_FREQUENCIES)[number];

function isEventColor(value: unknown): value is EventColor {
  return (
    typeof value === "string" &&
    (EVENT_COLORS as readonly string[]).includes(value)
  );
}

function parseDaysOfWeek(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
      }
    } catch {
      return [];
    }
  }
  return [];
}

function stringifyDaysOfWeek(days: number[]): string {
  return JSON.stringify(days);
}

type ParseHabitResult =
  | { ok: true; data: HabitPayload }
  | { ok: false; error: string };

export function parseHabitInput(value: unknown): ParseHabitResult {
  const body = (value ?? {}) as Record<string, unknown>;

  const name = trimmedStringOrNull(body.name);
  if (!name) {
    return { ok: false, error: "Name is required" };
  }

  const frequency: HabitFrequency = body.frequency === "weekly" ? "weekly" : "daily";
  const daysOfWeek = parseDaysOfWeek(body.daysOfWeek);
  const targetCount =
    typeof body.targetCount === "number" &&
    Number.isFinite(body.targetCount) &&
    body.targetCount >= 1
      ? Math.floor(body.targetCount)
      : 1;

  // Daily habits require at least one day of week
  if (frequency === "daily" && daysOfWeek.length === 0) {
    return { ok: false, error: "At least one day of week is required for daily habits" };
  }

  // Weekly habits should not have specific days
  const finalDaysOfWeek = frequency === "daily" ? daysOfWeek : [];

  return {
    ok: true,
    data: {
      name,
      description: trimmedStringOrNull(body.description) ?? "",
      icon: typeof body.icon === "string" && body.icon ? body.icon : "CheckCircle2",
      color: isEventColor(body.color) ? body.color : "green",
      frequency,
      daysOfWeek: stringifyDaysOfWeek(finalDaysOfWeek),
      targetCount,
    },
  };
}

type ParseHabitPatchResult =
  | { ok: true; data: HabitPatch }
  | { ok: false; error: string };

export function parseHabitPatch(value: unknown): ParseHabitPatchResult {
  const body = (value ?? {}) as Record<string, unknown>;

  const name = body.name !== undefined ? trimmedStringOrNull(body.name) : undefined;
  if (name !== undefined && !name) {
    return { ok: false, error: "Name is required" };
  }

  const frequency = body.frequency !== undefined
    ? (body.frequency === "weekly" ? "weekly" : "daily")
    : undefined;

  const daysOfWeek = body.daysOfWeek !== undefined
    ? parseDaysOfWeek(body.daysOfWeek)
    : undefined;

  const targetCount =
    typeof body.targetCount === "number" &&
    Number.isFinite(body.targetCount) &&
    body.targetCount >= 1
      ? Math.floor(body.targetCount)
      : undefined;

  // If frequency is being changed to daily, daysOfWeek must be provided
  if (frequency === "daily" && (daysOfWeek === undefined || daysOfWeek.length === 0)) {
    return { ok: false, error: "At least one day of week is required for daily habits" };
  }

  // Sem mudar a frequência, não é possível limpar os dias: quebraria a
  // invariante de que hábitos diários têm ao menos um dia.
  if (frequency === undefined && daysOfWeek !== undefined && daysOfWeek.length === 0) {
    return { ok: false, error: "At least one day of week is required for daily habits" };
  }

  // Se a frequência passa a ser semanal, os dias selecionados são descartados
  // (a UI os envia ao alternar de diário para semanal).
  const finalDaysOfWeek =
    frequency === "daily" ? daysOfWeek : frequency === "weekly" ? [] : daysOfWeek;

  return {
    ok: true,
    data: {
      name,
      description: body.description !== undefined ? trimmedStringOrNull(body.description) : undefined,
      icon: typeof body.icon === "string" && body.icon ? body.icon : undefined,
      color: isEventColor(body.color) ? body.color : undefined,
      frequency,
      daysOfWeek: finalDaysOfWeek !== undefined ? stringifyDaysOfWeek(finalDaysOfWeek) : undefined,
      targetCount,
    },
  };
}