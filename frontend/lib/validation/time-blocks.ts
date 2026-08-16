import type {
  EventColor,
  EventConfirmation,
  TimeBlockInput,
  TimeBlockPatch,
  TimeBlockPayload,
} from "@/types/domain";
import { CONFIRMATION_OPTIONS, EVENT_COLORS } from "@/lib/calendar/event-constants";
import { dateFromString, trimmedStringOrNull } from "./helpers";

export function parseTimeBlockInput(value: unknown): TimeBlockPayload | null {
  const body = (value ?? {}) as TimeBlockInput;

  const title = trimmedStringOrNull(body.title);
  const start = dateFromString(body.start);
  const end = dateFromString(body.end);

  if (!title || !start || !end) return null;
  const isAllDay = body.isAllDay === true;
  // All-day 00:00-00:00 e valido; caso contrario o fim deve ser depois.
  if (
    end.getTime() < start.getTime() ||
    (end.getTime() === start.getTime() && !isAllDay)
  ) {
    return null;
  }

  return {
    title,
    description: trimmedStringOrNull(body.description),
    start,
    end,
    isAllDay,
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

  const start = dateFromString(body.start);
  if (start) patch.start = start;

  const end = dateFromString(body.end);
  if (end) patch.end = end;

  if (typeof body.isAllDay === "boolean") {
    patch.isAllDay = body.isAllDay;
  }

  if (isEventColor(body.color)) {
    patch.color = body.color;
  }

  if (isEventConfirmation(body.confirmation)) {
    patch.confirmation = body.confirmation;
  }

  if (
    patch.start &&
    patch.end &&
    (patch.end.getTime() < patch.start.getTime() ||
      (patch.end.getTime() === patch.start.getTime() &&
        patch.isAllDay !== true))
  ) {
    return null;
  }

  return patch;
}

function isEventColor(value: unknown): value is EventColor {
  return (
    typeof value === "string" &&
    (EVENT_COLORS as readonly string[]).includes(value)
  );
}

function isEventConfirmation(value: unknown): value is EventConfirmation {
  return (
    typeof value === "string" &&
    (CONFIRMATION_OPTIONS as readonly string[]).includes(value)
  );
}