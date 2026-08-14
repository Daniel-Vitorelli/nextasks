import type { CalendarEvent, EventColor, EventConfirmation } from "@/types/calendar";
import type {
  ParsedTime,
  TimeBlock,
  TimeBlockInput,
  TimeBlockPatch,
  TimeBlockPatchPayload,
  TimeBlockPayload,
} from "@/types/domain";

export const EVENT_COLORS: EventColor[] = [
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "gray",
];

export const CONFIRMATION_OPTIONS: {
  value: EventConfirmation;
}[] = [
  { value: "none" },
  { value: "checklist" },
  { value: "score" },
];

export function parseTimeBlockInput(value: unknown): TimeBlockPayload | null {
  const body = (value ?? {}) as TimeBlockInput;

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const start =
    typeof body.start === "string" &&
    !Number.isNaN(Date.parse(body.start)) &&
    new Date(body.start as string);
  const end =
    typeof body.end === "string" &&
    !Number.isNaN(Date.parse(body.end)) &&
    new Date(body.end as string);

  if (!title) return null;
  if (!(start instanceof Date) || !(end instanceof Date)) return null;
  if (end.getTime() <= start.getTime()) return null;

  return {
    title,
    description:
      typeof body.description === "string"
        ? body.description.trim() || null
        : null,
    start,
    end,
    isAllDay: body.isAllDay === true,
    color: isEventColor(body.color) ? body.color : "green",
    confirmation: isEventConfirmation(body.confirmation)
      ? body.confirmation
      : "none",
  };
}

export function parseTimeBlockPatch(value: unknown): TimeBlockPatch | null {
  const body = (value ?? {}) as TimeBlockInput;
  const patch: TimeBlockPatch = {};

  if (typeof body.title === "string") {
    const title = body.title.trim();
    if (!title) return null;
    patch.title = title;
  }

  if (typeof body.description === "string") {
    patch.description = body.description.trim() || null;
  }

  if (typeof body.start === "string" && !Number.isNaN(Date.parse(body.start))) {
    patch.start = new Date(body.start as string);
  }

  if (typeof body.end === "string" && !Number.isNaN(Date.parse(body.end))) {
    patch.end = new Date(body.end as string);
  }

  if (typeof body.isAllDay === "boolean") {
    patch.isAllDay = body.isAllDay;
  }

  if (isEventColor(body.color)) {
    patch.color = body.color;
  }

  if (isEventConfirmation(body.confirmation)) {
    patch.confirmation = body.confirmation;
  }

  if (patch.start && patch.end && patch.end.getTime() <= patch.start.getTime()) {
    return null;
  }

  return patch;
}

function isEventColor(value: unknown): value is EventColor {
  return typeof value === "string" && EVENT_COLORS.includes(value as EventColor);
}

function isEventConfirmation(value: unknown): value is EventConfirmation {
  return (
    typeof value === "string" &&
    CONFIRMATION_OPTIONS.some((option) => option.value === value)
  );
}

export function toCalendarEvent(block: TimeBlock): CalendarEvent {
  return {
    id: block.id,
    title: block.title,
    description: block.description ?? undefined,
    start: new Date(block.start),
    end: new Date(block.end),
    isAllDay: block.isAllDay,
    color: block.color,
    confirmation: block.confirmation,
  };
}

export function fromCalendarEvent(event: CalendarEvent): TimeBlockPatchPayload {
  return {
    title: event.title,
    description: event.description ?? undefined,
    start: event.start,
    end: event.end,
    isAllDay: event.isAllDay ?? false,
    color: event.color ?? "green",
    confirmation: event.confirmation ?? "none",
  };
}

export function createBlockStub(anchor: Date): {
  start: Date;
  end: Date;
} {
  const start = new Date(
    anchor.getFullYear(),
    anchor.getMonth(),
    anchor.getDate(),
    anchor.getHours(),
  );
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return { start, end };
}

/**
 * Parses a user-typed time string into hours and minutes.
 * Accepts formats: "3 PM", "3:30 PM", "15:00", "3pm", "330pm", "3:30pm".
 * Returns null if the input cannot be parsed.
 */
export function parseTimeInput(input: string): ParsedTime | null {
  const trimmed = input.trim().toLowerCase();
  if (trimmed.length === 0) {
    return null;
  }

  const isPM = /pm$/.test(trimmed);
  const isAM = /am$/.test(trimmed);
  const stripped = trimmed.replace(/\s*(am|pm)\s*$/, "").trim();

  if (stripped.length === 0) {
    return null;
  }

  let hours: number;
  let minutes: number;

  if (stripped.includes(":")) {
    const parts = stripped.split(":");
    if (parts.length !== 2) {
      return null;
    }
    hours = Number.parseInt(parts[0], 10);
    minutes = Number.parseInt(parts[1], 10);
  } else {
    const num = Number.parseInt(stripped, 10);
    if (Number.isNaN(num)) {
      return null;
    }
    if (stripped.length > 2 && num > 99) {
      // e.g., "330" → 3:30, "1230" → 12:30
      minutes = num % 100;
      hours = Math.floor(num / 100);
    } else {
      hours = num;
      minutes = 0;
    }
  }

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }

  // Apply AM/PM conversion
  if (isPM && hours < 12) {
    hours += 12;
  }
  if (isAM && hours === 12) {
    hours = 0;
  }

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return { hours, minutes };
}

/**
 * Returns a new Date with the same year/month/day as `base`
 * but with hours and minutes replaced.
 */
export function applyTimeToDate(
  base: Date,
  hours: number,
  minutes: number,
): Date {
  const result = new Date(base);
  result.setHours(hours, minutes, 0, 0);
  return result;
}
