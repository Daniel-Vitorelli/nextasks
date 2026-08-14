import { isSameDay, startOfDay } from "date-fns";
import type { CalendarEvent, WeekDay } from "@/types/calendar";
import { isMultiDayEvent } from "./positioning";

/** A positioned all-day event row for stacking */
export interface AllDayEventRow {
  event: CalendarEvent;
  startColumn: number;
  endColumn: number;
  row: number;
}

/**
 * Groups all-day events by their visual row (for stacking)
 */
export function calculateAllDayEventRows(
  events: CalendarEvent[],
  days: WeekDay[],
): AllDayEventRow[] {
  const allDayEvents = events.filter((e) => e.isAllDay || isMultiDayEvent(e));

  if (allDayEvents.length === 0) {
    return [];
  }

  // Sort by start date, then by duration (longer first)
  const sortedEvents = [...allDayEvents].sort((a, b) => {
    const startDiff = a.start.getTime() - b.start.getTime();
    if (startDiff !== 0) {
      return startDiff;
    }
    const durationA = a.end.getTime() - a.start.getTime();
    const durationB = b.end.getTime() - b.start.getTime();
    return durationB - durationA;
  });

  const rows: AllDayEventRow[] = [];
  const occupiedRows: Map<number, { start: number; end: number }[]> = new Map();

  for (const event of sortedEvents) {
    // Find start and end columns
    let startColumn = -1;
    let endColumn = -1;

    for (let i = 0; i < days.length; i++) {
      const day = days[i];
      const dayStart = startOfDay(day.date);

      if (
        isSameDay(event.start, day.date) ||
        (event.start <= dayStart && event.end >= dayStart)
      ) {
        if (startColumn === -1) {
          startColumn = i;
        }
        endColumn = i;
      }
    }

    if (startColumn === -1) {
      continue;
    }

    // Find the first row where this event fits
    let targetRow = 0;
    let foundRow = false;

    while (!foundRow) {
      const rowOccupied = occupiedRows.get(targetRow) ?? [];
      const hasConflict = rowOccupied.some(
        (occupied) =>
          !(endColumn < occupied.start || startColumn > occupied.end),
      );

      if (!hasConflict) {
        foundRow = true;
        break;
      }

      targetRow++;
    }

    // Mark the row as occupied
    const rowOccupied = occupiedRows.get(targetRow) ?? [];
    rowOccupied.push({ start: startColumn, end: endColumn });
    occupiedRows.set(targetRow, rowOccupied);

    rows.push({
      event,
      startColumn,
      endColumn,
      row: targetRow,
    });
  }

  return rows;
}
