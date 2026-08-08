"use client";

import { useCallback } from "react";
import { isPast, isSameDay } from "date-fns";

import { AllDayEventItem } from "./all-day-event-item";
import { useCalendarPopoverBoundary } from "./calendar-popover-context";
import type { CalendarEvent, WeekViewAllDayRowProps } from "./week-view-types";

export const ALL_DAY_EVENT_HEIGHT = 24;
export const ALL_DAY_ROW_GAP = 2;

interface AllDayEventRowProps {
  event: CalendarEvent;
  startColumn: number;
  endColumn: number;
  row: number;
  totalColumns: number;
  days: WeekViewAllDayRowProps["days"];
  onEventClick?: (event: CalendarEvent) => void;
  isSelected?: boolean;
  onAllDayResizeMouseDown?: WeekViewAllDayRowProps["onAllDayResizeMouseDown"];
  originalStartColumn: number;
  originalEndColumn: number;
  isBeingResized?: boolean;
  isBeingMoved?: boolean;
  /** Callback when an event is changed (e.g. color change from context menu) */
  onEventChange?: (event: CalendarEvent) => void;
  /** Callback when an event should be deleted */
  onEventDelete?: (event: CalendarEvent) => void;
  /** Callback when an event should be duplicated */
  onEventDuplicate?: (event: CalendarEvent) => void;
  /** Callback when context menu open state changes */
  onContextMenuOpenChange?: (open: boolean) => void;
  isSidebarOpen?: boolean;
  onDockToSidebar?: () => void;
  onClosePopover?: () => void;
  onPrevWeek?: () => void;
  onNextWeek?: () => void;
  /** Index of the first visible column (for sticky-title offset) */
  visibleStartIndex?: number;
}

/** Renders a single all-day event at its grid position. */
export function AllDayEventRow({
  event,
  startColumn,
  endColumn,
  row,
  totalColumns,
  days,
  onEventClick,
  isSelected,
  onAllDayResizeMouseDown,
  originalStartColumn,
  originalEndColumn,
  isBeingResized,
  isBeingMoved,
  onEventChange,
  onEventDelete,
  onEventDuplicate,
  onContextMenuOpenChange,
  isSidebarOpen,
  onDockToSidebar,
  onClosePopover,
  onPrevWeek,
  onNextWeek,
  visibleStartIndex,
}: AllDayEventRowProps) {
  const { view } = useCalendarPopoverBoundary();
  const isDayView = view === "day";

  const left = (startColumn / totalColumns) * 100;
  // Day view uses a smaller right gap than week view so events nearly fill
  // the column but still show a sliver of the grid \u2014 matching Notion Calendar.
  const columnWidth = 100 / totalColumns;
  const rightGap = isDayView ? columnWidth * 0.02 : columnWidth * 0.08;
  const width = ((endColumn - startColumn + 1) / totalColumns) * 100 - rightGap;
  const top = row * (ALL_DAY_EVENT_HEIGHT + ALL_DAY_ROW_GAP);

  // During resize, both edges are always visible so force rounding on both sides
  const spanStart =
    isBeingResized || isSameDay(event.start, days[startColumn].date);
  const spanEnd = isBeingResized || isSameDay(event.end, days[endColumn].date);

  /**
   * In day view with buffer days (column: buffer | visible | buffer),
   * the visible column is index 1. Multi-day events that start in the left
   * buffer (column 0) have their title off-screen. Calculate the percentage
   * offset needed to push the title into the visible area.
   *
   * CSS `padding-left` percentages are relative to the **containing block's
   * width** (the wrapper div), not the grid container. We must convert from
   * container-relative coordinates to wrapper-relative coordinates:
   *   offset = (visibleStart% - left%) \u00D7 (100 / width%)
   */
  const visibleColumnIndex = visibleStartIndex ?? 1;
  const visibleStartPercent = (visibleColumnIndex / totalColumns) * 100;
  const hiddenContainerPercent = isDayView
    ? Math.max(0, visibleStartPercent - left)
    : 0;
  /** Small extra nudge (in container %) so the title doesn't sit flush
   *  against the visible column edge \u2014 gives it a bit of breathing room. */
  const TITLE_NUDGE_PERCENT = 0.1;
  const titleOffsetPercent =
    hiddenContainerPercent > 0 && width > 0
      ? ((hiddenContainerPercent + TITLE_NUDGE_PERCENT) / width) * 100
      : 0;

  const handleResizeMouseDown = useCallback(
    (
      e: React.MouseEvent,
      ev: CalendarEvent,
      edge: "left" | "right" | "move",
    ) => {
      onAllDayResizeMouseDown?.(
        e,
        ev,
        edge,
        originalStartColumn,
        originalEndColumn,
      );
    },
    [onAllDayResizeMouseDown, originalStartColumn, originalEndColumn],
  );

  return (
    <div
      className="absolute"
      style={{
        left: `${left}%`,
        width: `${width}%`,
        top: `${top}px`,
        paddingLeft: "2px",
        paddingRight: "2px",
      }}
    >
      <AllDayEventItem
        event={event}
        isPast={isPast(event.end)}
        isSelected={isBeingMoved ? false : isSelected}
        onClick={onEventClick}
        spanStart={spanStart}
        spanEnd={spanEnd}
        onResizeMouseDown={handleResizeMouseDown}
        onEventChange={onEventChange}
        onEventDelete={onEventDelete}
        onEventDuplicate={onEventDuplicate}
        onContextMenuOpenChange={onContextMenuOpenChange}
        isSidebarOpen={isSidebarOpen}
        onDockToSidebar={onDockToSidebar}
        onClosePopover={onClosePopover}
        onPrevWeek={onPrevWeek}
        onNextWeek={onNextWeek}
        titleOffsetPercent={titleOffsetPercent}
        dragVariant={isBeingMoved ? "ghost" : undefined}
      />
    </div>
  );
}

/** Placeholder border-only outline rendered at the target position during move */
export function AllDayPlaceholderRow({
  event,
  startColumn,
  endColumn,
  row,
  totalColumns,
}: {
  event: CalendarEvent;
  startColumn: number;
  endColumn: number;
  row: number;
  totalColumns: number;
}) {
  const columnWidth = 100 / totalColumns;
  const left = (startColumn / totalColumns) * 100;
  const rightGap = columnWidth * 0.08;
  const width = ((endColumn - startColumn + 1) / totalColumns) * 100 - rightGap;
  const top = row * (ALL_DAY_EVENT_HEIGHT + ALL_DAY_ROW_GAP);

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${left}%`,
        width: `${width}%`,
        top: `${top}px`,
        paddingLeft: "2px",
        paddingRight: "2px",
        zIndex: 25,
      }}
    >
      <AllDayEventItem
        event={event}
        spanStart
        spanEnd
        dragVariant="placeholder"
      />
    </div>
  );
}