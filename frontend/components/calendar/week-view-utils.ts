import {
  addDays,
  eachDayOfInterval,
  format,
  getWeek,
  type Locale,
} from "date-fns";
import type { HourSlot, ViewType, WeekDay } from "./week-view-types";

/** Minimum height of each hour row in pixels */
export const MIN_HOUR_HEIGHT = 48;

/** Width of the time axis column in pixels (4rem = 64px) */
export const TIME_AXIS_WIDTH = 64;

/** Minimum width of a single day column in pixels (enables horizontal
 * scrolling on narrow screens instead of crushing the columns) */
export const MIN_DAY_COLUMN_WIDTH = 64;

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

/**
 * Returns the month name, year, and week number for the current date
 */
export function getCalendarHeaderInfo(
  currentDate: Date,
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6,
) {
  return {
    monthName: format(currentDate, "MMMM"),
    year: format(currentDate, "yyyy"),
    weekNumber: getWeek(currentDate, { weekStartsOn }),
  };
}

/**
 * Returns the visible days starting from the given date (used for sidebar highlighting)
 */
export function getVisibleDays(
  currentDate: Date,
  view: ViewType = "week",
): Date[] {
  const count = VISIBLE_DAYS_BY_VIEW[view];
  const end = addDays(currentDate, count - 1);
  return eachDayOfInterval({ start: currentDate, end });
}