import type { Duration, Frequency, RoutinePayload } from "@/types/domain";
import { dateFromString, trimmedStringOrNull } from "./helpers";

export const FREQUENCIES: readonly Frequency[] = ["daily", "weekly"];
export const DURATIONS: readonly Duration[] = ["indefinite", "until"];

type ParseRoutineResult =
  | { ok: true; data: RoutinePayload }
  | { ok: false; error: string };

export function parseRoutineInput(value: unknown): ParseRoutineResult {
  const body = (value ?? {}) as Record<string, unknown>;

  const name = trimmedStringOrNull(body.name);
  if (!name) {
    return { ok: false, error: "Name is required" };
  }

  const frequency: Frequency = body.frequency === "weekly" ? "weekly" : "daily";
  const duration: Duration = body.duration === "until" ? "until" : "indefinite";

  return {
    ok: true,
    data: {
      name,
      description: trimmedStringOrNull(body.description),
      frequency,
      duration,
      endDate: duration === "until" ? dateFromString(body.endDate) : null,
    },
  };
}