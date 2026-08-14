"use client";

import React from "react";
import { isSameDay } from "date-fns";
import { cn } from "@/lib/utils";
import { calculatePositionedEvents } from "@/lib/event-utils";
import { DayEventsColumn } from "./day-events-column";
import { WeekViewGridOverlays } from "./week-view-grid-overlays";
import { useCalendarPopoverBoundary } from "./calendar-popover-context";
import type { WeekViewGridProps } from "./week-view-types";

/**
 * Main grid displaying hour/day intersection cells with events
 * Each cell represents one hour in one day
 */
export function WeekViewGrid({
  days,
  hours,
  hourHeight,
  events = [],
  onEventClick,
  selectedEventId,
  dragState,
  onEventDragMouseDown,
  resizeState,
  onEventResizeMouseDown,
  onEventChange,
  onEventDelete,
  onEventDuplicate,
  onCellDoubleClick,
  onContextMenuOpenChange,
  isSidebarOpen,
  onDockToSidebar,
  onClosePopover,
  onPrevWeek,
  onNextWeek,
  highlightedDate,
  className,
}: WeekViewGridProps) {
  const { view } = useCalendarPopoverBoundary();
  const isDayView = view === "day";
  const gridRef = React.useRef<HTMLDivElement>(null);
  const [gridWidth, setGridWidth] = React.useState(0);

  React.useEffect(() => {
    const el = gridRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setGridWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={gridRef} className={cn("relative", className)}>
      {/* Background grid */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${days.length}, 1fr)`,
          gridTemplateRows: `repeat(${hours.length}, ${hourHeight}px)`,
        }}
      >
        {hours.map((hourSlot) =>
          days.map((day) => {
            const isWeekend =
              day.date.getDay() === 0 || day.date.getDay() === 6;
            return (
              <div
                key={`${day.date.toISOString()}-${hourSlot.hour}`}
                onDoubleClick={() =>
                  onCellDoubleClick?.(day.date, hourSlot.hour)
                }
                className={cn(
                  "border-border border-b border-l",
                  isWeekend && "bg-calendar-weekend",
                )}
              />
            );
          }),
        )}
      </div>

      {/* Column highlight layer — brief background fade for "+N more" navigation */}
      {highlightedDate && (
        <div
          className="absolute inset-0 grid pointer-events-none"
          style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}
        >
          {days.map((day) => (
            <div
              key={day.date.toISOString()}
              className={cn(
                isSameDay(day.date, highlightedDate) && "column-highlight",
              )}
            />
          ))}
        </div>
      )}

      {/* Events layer */}
      <div
        className="absolute inset-0 grid pointer-events-none"
        style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}
      >
        {days.map((day) => {
          /**
           * Day view uses a smaller right gap than week view so events
           * nearly fill the column but still show a sliver of the grid
           * line — matching Notion Calendar's day-view styling. On narrow
           * screens the same small gap is used so overlapping blocks stay
           * as wide as possible.
           */
          const rightGap =
            isDayView || gridWidth < 560 ? 2 : 8;
          const positionedEvents = calculatePositionedEvents(
            events,
            day,
            rightGap,
          );

          return (
            <DayEventsColumn
              key={day.date.toISOString()}
              columnDate={day.date}
              events={positionedEvents}
              hourHeight={hourHeight}
              onEventClick={onEventClick}
              selectedEventId={selectedEventId}
              dragState={dragState}
              onEventDragMouseDown={onEventDragMouseDown}
              resizeState={resizeState}
              onEventResizeMouseDown={onEventResizeMouseDown}
              onEventChange={onEventChange}
              onEventDelete={onEventDelete}
              onEventDuplicate={onEventDuplicate}
              onContextMenuOpenChange={onContextMenuOpenChange}
              isSidebarOpen={isSidebarOpen}
              onDockToSidebar={onDockToSidebar}
              onClosePopover={onClosePopover}
              onPrevWeek={onPrevWeek}
              onNextWeek={onNextWeek}
            />
          );
        })}
      </div>

      <WeekViewGridOverlays
        days={days}
        hourHeight={hourHeight}
        dragState={dragState}
        resizeState={resizeState}
        gridWidth={gridWidth}
      />
    </div>
  );
}

