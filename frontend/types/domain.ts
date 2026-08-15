/**
 * Domain types shared across the app (routines, time blocks, completions).
 */

import type { CalendarEvent, EventColor, EventConfirmation } from "./calendar";

/** How often a routine repeats */
export type Frequency = "daily" | "weekly";

/** How long a routine stays active */
export type Duration = "indefinite" | "until";

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

/** Validated routine payload accepted by the API (endDate as a Date) */
export interface RoutinePayload {
  name: string;
  description: string | null;
  frequency: Frequency;
  duration: Duration;
  endDate: Date | null;
}

export interface TimeBlock {
  id: string;
  routineId: string;
  title: string;
  description: string | null;
  start: string;
  end: string;
  isAllDay: boolean;
  color: EventColor;
  confirmation: EventConfirmation;
}

/** Raw JSON body accepted by the time-block API endpoints */
export interface TimeBlockInput {
  title?: unknown;
  description?: unknown;
  start?: unknown;
  end?: unknown;
  isAllDay?: unknown;
  color?: unknown;
  confirmation?: unknown;
}

export interface TimeBlockPayload {
  title: string;
  description: string | null;
  start: Date;
  end: Date;
  isAllDay: boolean;
  color: EventColor;
  confirmation: EventConfirmation;
}

export interface TimeBlockPatch {
  title?: string;
  description?: string | null;
  start?: Date;
  end?: Date;
  isAllDay?: boolean;
  color?: EventColor;
  confirmation?: EventConfirmation;
}

/** All CalendarEvent fields except id (what a block patch can carry) */
export type TimeBlockPatchPayload = Omit<CalendarEvent, "id">;

export interface ParsedTime {
  hours: number;
  minutes: number;
}

/** A time window (used for completion validity periods) */
export interface Period {
  start: Date;
  end: Date;
}

/** One day of routine progress (value is 0-100 or null when not applicable) */
export interface DailyProgress {
  date: string;
  value: number | null;
  confirmableBlocks: number;
  confirmedValue: number;
}

/** Response of the routine progress endpoint */
export interface ProgressResponse {
  routine: Routine | null;
  progress: DailyProgress[];
  period: Period | null;
}
