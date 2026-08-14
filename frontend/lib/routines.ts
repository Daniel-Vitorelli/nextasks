export const FREQUENCIES = ["daily", "weekly"] as const;
export const DURATIONS = ["indefinite", "until"] as const;

export type Frequency = (typeof FREQUENCIES)[number];
export type Duration = (typeof DURATIONS)[number];

export interface Routine {
  id: string;
  name: string;
  description: string | null;
  frequency: Frequency;
  duration: Duration;
  endDate: string | null;
  isActive: boolean;
}

export interface RoutineFormValues {
  name: string;
  description: string;
  frequency: Frequency;
  duration: Duration;
  endDate: string;
}

interface RoutineInput {
  name?: unknown;
  description?: unknown;
  frequency?: unknown;
  duration?: unknown;
  endDate?: unknown;
}

interface RoutinePayload {
  name: string;
  description: string | null;
  frequency: Frequency;
  duration: Duration;
  endDate: Date | null;
}

type ParseRoutineResult =
  | { ok: true; data: RoutinePayload }
  | { ok: false; error: string };

export function parseRoutineInput(value: unknown): ParseRoutineResult {
  const body = (value ?? {}) as RoutineInput;

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