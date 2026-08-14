import {
  addDays,
  eachDayOfInterval,
  eachWeekOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getWeek,
  isSameDay,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import type { CalendarEvent, WeekDay } from "@/types/calendar";
import { isMultiDayEvent } from "./positioning";

/** Height of a single event row in the month grid (px): h-5 (20px) + gap-px (1px) */
export const MONTH_EVENT_ROW_HEIGHT = 21;

/** Height consumed by the day number header inside each cell (px) */
const MONTH_DAY_HEADER_HEIGHT = 28;

/** Minimum visible event slots per month cell (just "+N more" at smallest) */
const MIN_MONTH_SLOTS = 1;

/** Maximum visible event slots per month cell (matches Notion Calendar) */
const MAX_MONTH_SLOTS = 6;

/**
 * One week row inside the month grid.
 */
export interface MonthWeekRow {
  weekNumber: number;
  days: WeekDay[];
}

/**
 * A single slot inside a month day cell.
 *
 * - `event-bar`  — a multi-day/all-day event bar that may span multiple columns
 * - `event-item` — a single-day timed event (dot + title)
 * - `more`       — the "+N more" overflow indicator
 * - `spacer`     — an empty placeholder to keep slot indices aligned
 */
export type MonthCellSlot =
  | {
      type: "event-bar";
      event: CalendarEvent;
      colSpan: number;
      isStart: boolean;
      roundedLeft: boolean;
      roundedRight: boolean;
    }
  | { type: "event-item"; event: CalendarEvent }
  | { type: "more"; count: number }
  | { type: "spacer" };

/**
 * Fully resolved layout for a single day cell in the month grid.
 *
 * `barSlots` — spanning (multi-day/all-day) event bars and alignment spacers.
 *              Rendered in a non-clipping container so bars can overflow
 *              horizontally to span adjacent columns.
 * `eventSlots` — timed single-day events and the "+N more" indicator.
 *               Rendered in an overflow-hidden container.
 */
export interface MonthDayCellLayout {
  date: Date;
  barSlots: MonthCellSlot[];
  eventSlots: MonthCellSlot[];
  totalEvents: number;
}

/**
 * Builds a WeekDay array for the 7-day interval starting at `weekStart`.
 */
function weekRowDays(weekStart: Date, weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6): WeekDay[] {
  const weekEnd = endOfWeek(weekStart, { weekStartsOn });
  return eachDayOfInterval({ start: weekStart, end: weekEnd }).map((day) => ({
    date: day,
    dayName: format(day, "EEE"),
    dayNumber: day.getDate(),
    isToday: isToday(day),
  }));
}

/**
 * Generates a single MonthWeekRow for the week containing the given date.
 * Used by vertical scroll to extend the buffer one row at a time.
 */
export function generateWeekRow(
  date: Date,
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 0,
): MonthWeekRow {
  const weekStart = startOfWeek(date, { weekStartsOn });

  return {
    weekNumber: getWeek(weekStart, { weekStartsOn }),
    days: weekRowDays(weekStart, weekStartsOn),
  };
}

/**
 * Generates the month grid rows for a given date.
 *
 * Returns 4-6 week rows, each containing 7 `WeekDay` objects.
 * The grid always starts on `weekStartsOn` and includes leading/trailing
 * days from adjacent months so every row is complete.
 */
export function generateMonthGrid(
  currentDate: Date,
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 0,
): MonthWeekRow[] {
  const gridStart = startOfWeek(startOfMonth(currentDate), { weekStartsOn });
  const gridEnd = endOfWeek(endOfMonth(currentDate), { weekStartsOn });

  return eachWeekOfInterval(
    { start: gridStart, end: gridEnd },
    { weekStartsOn },
  ).map((weekStart) => ({
    weekNumber: getWeek(weekStart, { weekStartsOn }),
    days: weekRowDays(weekStart, weekStartsOn),
  }));
}

/**
 * Generates `count` consecutive MonthWeekRows starting from the week
 * containing `startDate`. Used as the base grid for the month view
 * so it can scroll row-by-row without anchoring to a calendar month.
 */
export function generateConsecutiveWeeks(
  startDate: Date,
  count: number,
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 0,
): MonthWeekRow[] {
  const firstWeekStart = startOfWeek(startDate, { weekStartsOn });
  return Array.from({ length: count }, (_, i) =>
    generateWeekRow(addDays(firstWeekStart, i * 7), weekStartsOn),
  );
}

/**
 * Returns the number of visible event slots for a month cell given its
 * pixel height.
 *
 * Clamped to [`MIN_MONTH_SLOTS`, `MAX_MONTH_SLOTS`].
 */
export function getMonthSlotCount(cellHeight: number): number {
  const usable = cellHeight - MONTH_DAY_HEADER_HEIGHT;
  const raw = Math.floor(usable / MONTH_EVENT_ROW_HEIGHT);
  return Math.max(MIN_MONTH_SLOTS, Math.min(MAX_MONTH_SLOTS, raw));
}

/**
 * Computes the full layout (slot arrays) for every day cell in the month grid.
 *
 * The algorithm processes one week row at a time so that spanning events keep
 * a stable slot index across columns.  Timed (single-day) events fill the
 * remaining slots.  When the total events exceed `maxSlots`, the last slot is
 * replaced with a "+N more" indicator.
 *
 * The returned Map is keyed by `startOfDay(date).toISOString()`.
 */
export function calculateMonthCellLayout(
  weekRows: MonthWeekRow[],
  events: CalendarEvent[],
  maxSlots: number,
): Map<string, MonthDayCellLayout> {
  const result = new Map<string, MonthDayCellLayout>();

  for (const row of weekRows) {
    const rowStart = startOfDay(row.days[0].date);
    const rowEnd = addDays(startOfDay(row.days[row.days.length - 1].date), 1);

    // ---- 1. Identify spanning events (all-day OR multi-day) that overlap this week row ----
    const spanningEvents = events.filter((ev) => {
      if (!ev.isAllDay && !isMultiDayEvent(ev)) {
        return false;
      }
      const evStart = startOfDay(ev.start);
      const evEnd = ev.isAllDay ? addDays(startOfDay(ev.end), 1) : ev.end;
      return evStart < rowEnd && evEnd > rowStart;
    });

    // Sort: longest first, then alphabetically by title
    spanningEvents.sort((a, b) => {
      const durA = a.end.getTime() - a.start.getTime();
      const durB = b.end.getTime() - b.start.getTime();
      if (durB !== durA) {
        return durB - durA;
      }
      return a.title.localeCompare(b.title);
    });

    // ---- 2. Assign stable slot indices for spanning events ----
    // slotAssignments[slotIndex] = array of { event, startCol, endCol }
    const slotAssignments: {
      event: CalendarEvent;
      startCol: number;
      endCol: number;
    }[][] = [];

    for (const ev of spanningEvents) {
      const evStart = startOfDay(ev.start);
      const evEnd = ev.isAllDay ? addDays(startOfDay(ev.end), 1) : ev.end;

      // Determine column range within this week row (0-6)
      let startCol = 0;
      let endCol = 6;

      for (let i = 0; i < row.days.length; i++) {
        const dayStart = startOfDay(row.days[i].date);
        const dayEnd = addDays(dayStart, 1);
        if (evStart < dayEnd && evEnd > dayStart) {
          startCol = i;
          break;
        }
      }
      for (let i = row.days.length - 1; i >= 0; i--) {
        const dayStart = startOfDay(row.days[i].date);
        const dayEnd = addDays(dayStart, 1);
        if (evStart < dayEnd && evEnd > dayStart) {
          endCol = i;
          break;
        }
      }

      // Find the first slot index where no existing assignment overlaps
      let targetSlot = 0;
      let placed = false;
      while (!placed) {
        if (targetSlot >= slotAssignments.length) {
          slotAssignments.push([]);
        }
        const occupied = slotAssignments[targetSlot];
        const hasConflict = occupied.some(
          (o) => !(endCol < o.startCol || startCol > o.endCol),
        );
        if (!hasConflict) {
          occupied.push({ event: ev, startCol, endCol });
          placed = true;
        } else {
          targetSlot++;
        }
      }
    }

    // ---- 3. Collect timed (single-day) events per column ----
    const timedByCol: CalendarEvent[][] = row.days.map(() => []);
    for (const ev of events) {
      if (ev.isAllDay || isMultiDayEvent(ev)) {
        continue;
      }
      for (let col = 0; col < row.days.length; col++) {
        const dayStart = startOfDay(row.days[col].date);
        const dayEnd = addDays(dayStart, 1);
        if (ev.start < dayEnd && ev.end > dayStart) {
          timedByCol[col].push(ev);
        }
      }
    }
    // Sort each column's timed events by start time
    for (const colEvents of timedByCol) {
      colEvents.sort((a, b) => a.start.getTime() - b.start.getTime());
    }

    // ---- 4. Build slots for each day cell ----
    for (let col = 0; col < row.days.length; col++) {
      const day = row.days[col];
      const key = startOfDay(day.date).toISOString();

      const barSlots: MonthCellSlot[] = [];
      const eventSlots: MonthCellSlot[] = [];

      // Count total events touching this cell
      let totalEvents = timedByCol[col].length;
      for (const slotRow of slotAssignments) {
        for (const assignment of slotRow) {
          if (col >= assignment.startCol && col <= assignment.endCol) {
            totalEvents++;
          }
        }
      }

      // Find the highest slot index that has a spanning event covering this column.
      // Only iterate up to that index so days without certain spanning events
      // don't get unnecessary spacer gaps.
      let maxSpanSlotIdx = -1;
      for (let slotIdx = 0; slotIdx < slotAssignments.length; slotIdx++) {
        const hasEvent = slotAssignments[slotIdx].some(
          (a) => col >= a.startCol && col <= a.endCol,
        );
        if (hasEvent) {
          maxSpanSlotIdx = slotIdx;
        }
      }

      // Fill bar slots — start cells get the full colSpan for visual spanning,
      // continuation cells get placeholders to maintain vertical alignment.
      for (let slotIdx = 0; slotIdx <= maxSpanSlotIdx; slotIdx++) {
        const assignment = slotAssignments[slotIdx].find(
          (a) => col >= a.startCol && col <= a.endCol,
        );

        if (!assignment) {
          barSlots.push({ type: "spacer" });
          continue;
        }

        const isStart = col === assignment.startCol;
        const colSpan = assignment.endCol - col + 1;

        const evEnd = assignment.event.isAllDay
          ? addDays(startOfDay(assignment.event.end), 1)
          : assignment.event.end;

        const roundedLeft =
          isStart && (isSameDay(assignment.event.start, day.date) || col === 0);

        // For roundedRight, check the END column of the assignment (not the
        // current col) so spanning bars rendered from the start cell get the
        // correct rounding on their trailing edge.
        const endDay = row.days[assignment.endCol].date;
        const roundedRight =
          evEnd <= addDays(startOfDay(endDay), 1) ||
          assignment.endCol === row.days.length - 1;

        if (isStart) {
          barSlots.push({
            type: "event-bar",
            event: assignment.event,
            colSpan,
            isStart: true,
            roundedLeft,
            roundedRight,
          });
        } else {
          // Continuation — invisible placeholder (bar rendered from start cell)
          barSlots.push({ type: "spacer" });
        }
      }

      // Fill remaining slots with timed events.
      const usedSlots = barSlots.length;
      const remainingSlots = maxSlots - usedSlots;
      const timedEvents = timedByCol[col];

      if (timedEvents.length < remainingSlots) {
        for (const ev of timedEvents) {
          eventSlots.push({ type: "event-item", event: ev });
        }
      } else if (timedEvents.length === 0) {
        // Nothing to render
      } else {
        const availableForTimed = Math.max(0, remainingSlots - 1);
        const timedToShow = timedEvents.slice(0, availableForTimed);
        for (const ev of timedToShow) {
          eventSlots.push({ type: "event-item", event: ev });
        }
        const hiddenCount = timedEvents.length - timedToShow.length;
        if (hiddenCount > 0) {
          eventSlots.push({ type: "more", count: hiddenCount });
        }
      }

      result.set(key, {
        date: day.date,
        barSlots,
        eventSlots,
        totalEvents,
      });
    }
  }

  return result;
}
