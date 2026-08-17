import { differenceInMinutes, format } from "date-fns";
import type { CalendarEvent } from "@/types/calendar";

/** Locale de 24h (ex.: pt) vs 12h (ex.: en). */
export function is24HourLocale(locale?: string): boolean {
  return locale?.toLowerCase().startsWith("pt") ?? false;
}

/**
 * Formats time showing only minutes if not on the hour
 * e.g., "10" for 10:00, "2:45" for 2:45 (en) / "14:45" (pt)
 */
export function formatTimeShort(date: Date, locale?: string): string {
  const minutes = date.getMinutes();
  const token = is24HourLocale(locale) ? "H" : "h";
  if (minutes === 0) {
    return format(date, token);
  }
  return format(date, `${token}:mm`);
}

/**
 * Formats event time as a compact range like "10–11 AM" or "11 AM–2 PM"
 * (en) or "14:30–15:00" (pt, 24h)
 */
export function formatEventTimeRange(
  event: CalendarEvent,
  locale?: string,
): string {
  if (is24HourLocale(locale)) {
    return `${formatTimeShort(event.start, locale)}\u2013${formatTimeShort(event.end, locale)}`;
  }

  const startTime = formatTimeShort(event.start);
  const endTime = formatTimeShort(event.end);
  const endPeriod = format(event.end, "a");
  const startPeriod = format(event.start, "a");

  // If same period (both AM or both PM), only show period at the end
  if (startPeriod === endPeriod) {
    return `${startTime}\u2013${endTime} ${endPeriod}`;
  }

  // Different periods, show both
  return `${startTime} ${startPeriod}\u2013${endTime} ${endPeriod}`;
}

/**
 * Formats time as "h a" or "h:mm a", e.g., "9 AM" or "6:30 PM" (en),
 * or "9" / "18:30" (pt, 24h)
 */
export function formatTimeDisplay(date: Date, locale?: string): string {
  const minutes = date.getMinutes();
  if (is24HourLocale(locale)) {
    return format(date, minutes === 0 ? "H" : "H:mm");
  }
  if (minutes === 0) {
    return format(date, "h a");
  }
  return format(date, "h:mm a");
}

export function formatDuration(
  start: Date,
  end: Date,
  locale?: string,
): string {
  const shortUnits = is24HourLocale(locale);
  const minutes = differenceInMinutes(end, start);
  if (minutes < 60) {
    return shortUnits ? `${minutes}min` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return `${hours}h`;
  }
  return shortUnits
    ? `${hours}h ${remainingMinutes}min`
    : `${hours}h ${remainingMinutes}m`;
}