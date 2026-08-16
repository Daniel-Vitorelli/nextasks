import type { CalendarEvent, CalendarEventPatch } from "@/types/calendar";
import type { ParsedTime, TimeBlock } from "@/types/domain";

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

export function fromCalendarEvent(event: CalendarEvent): CalendarEventPatch {
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

  // Um bloco nunca cruza a meia-noite: se o fim cairia no dia seguinte,
  // ele vai ao ultimo horario disponivel do dia (23:59:59.999).
  if (
    end.getFullYear() !== start.getFullYear() ||
    end.getMonth() !== start.getMonth() ||
    end.getDate() !== start.getDate()
  ) {
    return {
      start,
      end: new Date(
        start.getFullYear(),
        start.getMonth(),
        start.getDate(),
        23,
        59,
        59,
        999,
      ),
    };
  }

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

/**
 * Copies the time-of-day (including seconds/milliseconds) from `source`
 * onto the date of `target`. Used to map stored block dates onto template
 * days while keeping the original clock time.
 */
export function applyTimeOfDay(target: Date, source: Date): Date {
  return new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
    source.getHours(),
    source.getMinutes(),
    source.getSeconds(),
    source.getMilliseconds(),
  );
}
