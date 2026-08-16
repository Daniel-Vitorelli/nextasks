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
  /** Quantos blocos confirmaveis (checklist/nota) a rotina ativa tem no total. */
  confirmableBlockCount: number;
  progress: DailyProgress[];
  period: Period | null;
}

/** Priority levels of a task (1 = lowest, 6 = highest) */
export const TASK_PRIORITIES = [1, 2, 3, 4, 5, 6] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export interface Task {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  priority: TaskPriority;
  done: boolean;
  createdAt: string;
}

/** Task form values (dueDate as yyyy-mm-dd string for the date input) */
export interface TaskFormValues {
  title: string;
  description: string;
  dueDate: string;
  priority: TaskPriority;
}

/** Validated task payload accepted by the API (dueDate as a Date) */
export interface TaskPayload {
  title: string;
  description: string | null;
  dueDate: Date | null;
  priority: TaskPriority;
}

/** Partial task patch (all fields optional) */
export interface TaskPatch {
  title?: string;
  description?: string | null;
  dueDate?: Date | null;
  priority?: TaskPriority;
  done?: boolean;
}

/** A subtask node of the task tree (parentId null = direct child of the task) */
export interface Subtask {
  id: string;
  title: string;
  description: string | null;
  parentId: string | null;
  done: boolean;
  children: Subtask[];
}

/** Subtask form values */
export interface SubtaskFormValues {
  title: string;
  description: string;
}

/** Validated subtask payload accepted by the API */
export interface SubtaskPayload {
  title: string;
  description: string | null;
}

/** Partial subtask patch (all fields optional) */
export interface SubtaskPatch {
  title?: string;
  description?: string | null;
  done?: boolean;
}
