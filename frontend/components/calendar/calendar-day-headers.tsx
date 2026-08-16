"use client";

import { isSameDay } from "date-fns";
import { cn } from "@/lib/utils";
import { getTimezoneAbbreviation } from "@/lib/calendar/timezone";
import type { WeekViewDayColumnsProps } from "./week-view-types";

/**
 * Day column headers showing day names and date numbers
 * Includes timezone label on the left (unless standalone mode)
 * Highlights the current day
 */
export function CalendarDayHeaders({
  days,
  standalone,
  highlightedDate,
  hideDayNumber,
  hideDayName,
  className,
}: WeekViewDayColumnsProps) {
  const timezone = getTimezoneAbbreviation();

  // Standalone mode: just render the day columns (used inside scroll container)
  if (standalone) {
    return (
      <div
        className={cn("grid", className)}
        style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}
      >
        {days.map((day) => (
          <div
            key={day.date.toISOString()}
            className={cn(
              "flex items-center justify-center py-1.5 text-sm sm:py-2",
              !hideDayName && !hideDayNumber ? "gap-0.5" : "gap-0",
              highlightedDate &&
                isSameDay(day.date, highlightedDate) &&
                "column-highlight",
            )}
          >
            {!hideDayName && (
              <span
                className={cn(
                  "hidden sm:block",
                  !hideDayNumber && day.isToday
                    ? "text-foreground font-medium"
                    : "text-muted-foreground font-normal",
                )}
              >
                {day.dayName}
              </span>
            )}
            {!hideDayNumber && (
              <span
                className={cn(
                  "flex h-4 w-4 items-center justify-center rounded-xs text-xs sm:h-5 sm:w-[1.2rem] sm:text-sm",
                  day.isToday
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-muted-foreground",
                )}
              >
                {day.dayNumber}
              </span>
            )}
          </div>
        ))}
      </div>
    );
  }

return (
    <div
      className={cn("grid bg-background", className)}
      style={{ gridTemplateColumns: "4rem 1fr" }}
    >
      {/* Timezone label */}
      <div className="text-muted-foreground flex items-center justify-end pr-2 text-xxs">
        {timezone}
      </div>

      {/* Day columns */}
      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}
      >
        {days.map((day) => (
          <div
            key={day.date.toISOString()}
            className={cn(
              "flex items-center justify-center py-1.5 text-sm sm:py-2",
              !hideDayName && !hideDayNumber ? "gap-0.5" : "gap-0",
              highlightedDate &&
                isSameDay(day.date, highlightedDate) &&
                "column-highlight",
            )}
          >
            {!hideDayName && (
              <span
                className={cn(
                  "hidden sm:block",
                  !hideDayNumber && day.isToday
                    ? "text-foreground font-medium"
                    : "text-muted-foreground font-normal",
                )}
              >
                {day.dayName}
              </span>
            )}
            {!hideDayNumber && (
              <span
                className={cn(
                  "flex h-4 w-4 items-center justify-center rounded-xs text-xs sm:h-5 sm:w-[1.2rem] sm:text-sm",
                  day.isToday
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-muted-foreground",
                )}
              >
                {day.dayNumber}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
