import {
  addDays,
  eachDayOfInterval,
  format,
  isToday,
  type Locale,
} from "date-fns";
import type { HourSlot, ViewType, WeekDay } from "@/types/calendar";

/** Minimum height of each hour row in pixels */
export const MIN_HOUR_HEIGHT = 48;

/** Width of the time axis column in pixels (4rem = 64px) */
export const TIME_AXIS_WIDTH = 64;

/** Minimum width of a single day column in pixels (enables horizontal
 * scrolling on narrow screens instead of crushing the columns) */
export const MIN_DAY_COLUMN_WIDTH = 64;

/** Minimum day column width on phones. Lets all 7 days fit horizontally on
 * narrow screens (otherwise the column would scroll out of the viewport). */
export const MIN_MOBILE_DAY_COLUMN_WIDTH = 42;

/** Width threshold below which the mobile column rules apply */
export const MOBILE_BREAKPOINT_PX = 640;

/** Number of visible days per view mode */
export const VISIBLE_DAYS_BY_VIEW: Record<ViewType, number> = {
  day: 1,
  week: 7,
  month: 7,
};

/** Buffer days per view mode (each side, for horizontal scroll) */
export const BUFFER_DAYS_BY_VIEW: Record<ViewType, number> = {
  day: 1,
  week: 7,
  month: 7,
};

/** Buffer extension step size per view mode */
export const BUFFER_STEP_BY_VIEW: Record<ViewType, number> = {
  day: 1,
  week: 7,
  month: 7,
};

/**
 * Generates an array of WeekDay objects starting from the given date.
 * Note: isToday is computed dynamically, not cached, to handle overnight page views
 */
export function generateWeekDays(
  startDate: Date,
  count: number,
  locale?: Locale,
): Omit<WeekDay, "isToday">[] {
  const end = addDays(startDate, count - 1);

  return eachDayOfInterval({ start: startDate, end }).map((date) => ({
    date,
    dayName: format(date, "EEE", { locale }),
    dayNumber: date.getDate(),
  }));
}

/**
 * Generates an extended array of days including buffer days on both sides
 * for smooth horizontal scroll transitions
 */
export function generateBufferedDays(
  startDate: Date,
  bufferDays: number,
  visibleDays: number,
  locale?: Locale,
): Omit<WeekDay, "isToday">[] {
  const bufferStart = addDays(startDate, -bufferDays);
  const bufferEnd = addDays(startDate, visibleDays + bufferDays - 1);

  return eachDayOfInterval({ start: bufferStart, end: bufferEnd }).map(
    (date) => ({
      date,
      dayName: format(date, "EEE", { locale }),
      dayNumber: date.getDate(),
    }),
  );
}

/**
 * Marca cada dia como "hoje" conforme a data atual.
 * isToday é calculado dinamicamente (não cacheado) para cobrir páginas
 * abertas durante a virada do dia.
 */
export function markIsToday(days: Omit<WeekDay, "isToday">[]): WeekDay[] {
  return days.map((day) => ({ ...day, isToday: isToday(day.date) }));
}

/**
 * Generates an array of HourSlot objects for all 24 hours
 */
export function generateHours(locale?: Locale): HourSlot[] {
  return Array.from({ length: 24 }, (_, i) => {
    const dateWithHour = new Date();
    dateWithHour.setHours(i, 0, 0, 0);
    return {
      hour: i,
      label: format(dateWithHour, "h a", { locale }),
    };
  });
}