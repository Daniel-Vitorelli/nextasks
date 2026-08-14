"use client";

import * as React from "react";
import { addDays, isPast, isSameDay, startOfDay } from "date-fns";

import { calculatePositionedEvents } from "@/lib/event-utils";
import { CalendarEventItem } from "./calendar-event-item";
import type {
  CalendarEvent,
  EventDragState,
  EventResizeState,
  PositionedEvent,
} from "./week-view-types";

interface DayEventsColumnProps {
  columnDate: Date;
  events: ReturnType<typeof calculatePositionedEvents>;
  hourHeight: number;
  onEventClick?: (event: CalendarEvent) => void;
  selectedEventId?: string;
  dragState?: EventDragState;
  onEventDragMouseDown?: (
    e: React.PointerEvent,
    event: CalendarEvent,
    targetEl?: HTMLElement,
  ) => void;
  resizeState?: EventResizeState;
  onEventResizeMouseDown?: (
    e: React.PointerEvent,
    event: CalendarEvent,
    edge: "top" | "bottom",
  ) => void;
  onEventChange?: (event: CalendarEvent) => void;
  onEventDelete?: (event: CalendarEvent) => void;
  onEventDuplicate?: (event: CalendarEvent) => void;
  onContextMenuOpenChange?: (open: boolean) => void;
  isSidebarOpen?: boolean;
  onDockToSidebar?: () => void;
  onClosePopover?: () => void;
  onPrevWeek?: () => void;
  onNextWeek?: () => void;
}

function renderColumnGhost(
  positionedEvent: PositionedEvent,
  hourHeight: number,
) {
  return (
    <CalendarEventItem
      key={`${positionedEvent.event.id}-ghost`}
      positionedEvent={positionedEvent}
      hourHeight={hourHeight}
      dragVariant="ghost"
    />
  );
}

export function DayEventsColumn({
  columnDate,
  events,
  hourHeight,
  onEventClick,
  selectedEventId,
  dragState,
  onEventDragMouseDown,
  resizeState,
  onEventResizeMouseDown,
  onEventChange,
  onEventDelete,
  onEventDuplicate,
  onContextMenuOpenChange,
  isSidebarOpen,
  onDockToSidebar,
  onClosePopover,
  onPrevWeek,
  onNextWeek,
}: DayEventsColumnProps) {
  return (
    <div className="relative h-full pointer-events-auto">
      {events.map((positionedEvent) => {
        const eventId = positionedEvent.event.id;
        const isBeingDragged =
          dragState?.isDragging && dragState.eventId === eventId;

        if (isBeingDragged) {
          return renderColumnGhost(positionedEvent, hourHeight);
        }

        const isBeingResized =
          resizeState?.isResizing && resizeState.eventId === eventId;

        if (isBeingResized) {
          const { effectiveEdge, currentStartDate, currentEndDate } =
            resizeState;
          const isCrossDay = !isSameDay(currentStartDate, currentEndDate);

          // Determine if this column is the anchor column
          const isAnchorColumn =
            (effectiveEdge === "bottom" &&
              isSameDay(columnDate, currentStartDate)) ||
            (effectiveEdge === "top" && isSameDay(columnDate, currentEndDate));

          // Check if this column is within the new range at all
          const colTime = columnDate.getTime();
          const inRange =
            colTime >= currentStartDate.getTime() &&
            colTime <= currentEndDate.getTime();

          // Non-anchor columns with original segments: render as ghost
          // Columns outside new range with original segments: render as ghost
          if (!isAnchorColumn || !inRange) {
            return renderColumnGhost(positionedEvent, hourHeight);
          }

          // Anchor column rendering
          let displayStart: Date;
          let displayEnd: Date;
          let segmentPosition: "start" | "middle" | "end" | "full";

          if (!isCrossDay) {
            // Same day: show currentStart to currentEnd
            displayStart = resizeState.currentStart;
            displayEnd = resizeState.currentEnd;
            segmentPosition = "full";
          } else if (effectiveEdge === "bottom") {
            // Anchor is start column: show currentStart to end-of-day
            displayStart = resizeState.currentStart;
            displayEnd = addDays(startOfDay(columnDate), 1);
            segmentPosition = "start";
          } else {
            // Anchor is end column: show start-of-day to currentEnd
            displayStart = startOfDay(columnDate);
            displayEnd = resizeState.currentEnd;
            segmentPosition = "end";
          }

          const resizePositioned = { ...positionedEvent, segmentPosition };

          return (
            <React.Fragment key={eventId}>
              {renderColumnGhost(positionedEvent, hourHeight)}
              <CalendarEventItem
                key={`${eventId}-resizing`}
                positionedEvent={resizePositioned}
                hourHeight={hourHeight}
                isPast={isPast(positionedEvent.event.end)}
                isSelected={isCrossDay || eventId === selectedEventId}
                overrideStart={displayStart}
                overrideEnd={displayEnd}
                onEventChange={onEventChange}
              />
            </React.Fragment>
          );
        }

        return (
          <CalendarEventItem
            key={eventId}
            positionedEvent={positionedEvent}
            hourHeight={hourHeight}
            isPast={isPast(positionedEvent.event.end)}
            isSelected={eventId === selectedEventId}
            onClick={onEventClick}
            onDragMouseDown={onEventDragMouseDown}
            onResizeMouseDown={onEventResizeMouseDown}
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
  );
}