import type { Duration, Frequency, RoutinePayload } from "@/types/domain";

export const FREQUENCIES: readonly Frequency[] = ["daily", "weekly"];
export const DURATIONS: readonly Duration[] = ["indefinite", "until"];

type ParseRoutineResult =
  | { ok: true; data: RoutinePayload }
  | { ok: false; error: string };

export function parseRoutineInput(value: unknown): ParseRoutineResult {
  const body = (value ?? {}) as Record<string, unknown>;

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return { ok: false, error: "Name is required" };
  }

  const frequency: Frequency = body.frequency === "weekly" ? "weekly" : "daily";
  const duration: Duration = body.duration === "until" ? "until" : "indefinite";

  const hasEndDate =
    duration === "until" &&
    typeof body.endDate === "string" &&
    !Number.isNaN(Date.parse(body.endDate));

  return {
    ok: true,
    data: {
      name,
      description:
        typeof body.description === "string" && body.description.trim()
          ? body.description.trim()
          : null,
      frequency,
      duration,
      endDate: hasEndDate ? new Date(body.endDate as string) : null,
    },
  };
}
