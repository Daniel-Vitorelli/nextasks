"use client";

import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { isSameDay } from "date-fns";
import { calculateAllDayEventRows } from "@/lib/event-utils";
import { AllDayEventItem } from "./all-day-event-item";
import type { WeekViewAllDayRowProps } from "./week-view-types";
import {
  ALL_DAY_EVENT_HEIGHT,
  ALL_DAY_ROW_GAP,
  AllDayEventRow,
  AllDayPlaceholderRow,
} from "./all-day-event-row";


/**
 * All-day row for displaying all-day events
 * Shows "All-day" label on the left with day columns
 */
export function WeekViewAllDayRow({
  days,
  allDayEvents = [],
  onEventClick,
  selectedEventId,
  scrollStyle,
  allDayResizeState,
  onAllDayResizeMouseDown,
  allDayScrollContentRef,
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
  visibleCount,
  dayColumnWidth,
  highlightedDate,
  className,
}: WeekViewAllDayRowProps) {
  const allEventRows = calculateAllDayEventRows(allDayEvents, days);

  // Filter out events entirely within buffer columns so they don't peek
  // through due to sub-pixel rendering at the scroll boundary.
  const visibleEnd =
    visibleStartIndex != null && visibleCount != null
      ? visibleStartIndex + visibleCount - 1
      : days.length - 1;
  const eventRows =
    visibleStartIndex != null
      ? allEventRows.filter(
          ({ startColumn, endColumn }) =>
            endColumn >= visibleStartIndex && startColumn <= visibleEnd,
        )
      : allEventRows;
  const maxRow =
    eventRows.length > 0 ? Math.max(...eventRows.map((r) => r.row)) + 1 : 0;
  const contentHeight =
    maxRow > 0 ? maxRow * (ALL_DAY_EVENT_HEIGHT + ALL_DAY_ROW_GAP) + 8 : 32;

  const isMoveDrag =
    allDayResizeState?.isResizing && allDayResizeState.edge === "move";

  return (
    <div
      className={cn(
        "border-border flex border-t border-b bg-background",
        className,
      )}
    >
      {/* All-day label - hidden on phones to give events the full width */}
      <div className="border-border text-muted-foreground flex w-16 flex-shrink-0 items-start justify-end border-r px-2 py-2 text-xxs">
        <span className="hidden sm:block">All-day</span>
      </div>

      {/* Day columns for all-day events - wrapped for scroll sync */}
      <div className="flex-1 overflow-hidden">
        <div ref={allDayScrollContentRef} style={scrollStyle}>
          <div className="relative" style={{ minHeight: `${contentHeight}px` }}>
            {/* Background grid */}
            <div
              className="absolute inset-0 grid"
              style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}
            >
              {days.map((day) => {
                const isWeekend =
                  day.date.getDay() === 0 || day.date.getDay() === 6;
                return (
                  <div
                    key={day.date.toISOString()}
                    className={cn(
                      "border-border border-l first:border-l-0 h-full",
                      isWeekend && "bg-calendar-weekend",
                      highlightedDate &&
                        isSameDay(day.date, highlightedDate) &&
                        "column-highlight",
                    )}
                  />
                );
              })}
            </div>

            {/* Events */}
            <div className="relative py-1 px-0.5">
              {eventRows.map(({ event, startColumn, endColumn, row }) => {
                const resizeState =
                  allDayResizeState?.eventId === event.id
                    ? allDayResizeState
                    : null;
                const isBeingResized = resizeState?.isResizing === true;
                const isBeingMoved =
                  isBeingResized && resizeState?.edge === "move";

                // For move: ghost stays at original, event renders at target
                // For resize: event renders at target (current columns)
                const displayStartColumn = isBeingResized
                  ? isBeingMoved
                    ? startColumn
                    : (resizeState?.currentStartColumn ?? startColumn)
                  : startColumn;
                const displayEndColumn = isBeingResized
                  ? isBeingMoved
                    ? endColumn
                    : (resizeState?.currentEndColumn ?? endColumn)
                  : endColumn;

                return (
                  <AllDayEventRow
                    key={event.id}
                    event={event}
                    startColumn={displayStartColumn}
                    endColumn={displayEndColumn}
                    row={row}
                    totalColumns={days.length}
                    days={days}
                    onEventClick={onEventClick}
                    isSelected={event.id === selectedEventId}
                    onAllDayResizeMouseDown={onAllDayResizeMouseDown}
                    originalStartColumn={startColumn}
                    originalEndColumn={endColumn}
                    isBeingResized={isBeingResized}
                    isBeingMoved={isBeingMoved}
                    onEventChange={onEventChange}
                    onEventDelete={onEventDelete}
                    onEventDuplicate={onEventDuplicate}
                    onContextMenuOpenChange={onContextMenuOpenChange}
                    isSidebarOpen={isSidebarOpen}
                    onDockToSidebar={onDockToSidebar}
                    onClosePopover={onClosePopover}
                    onPrevWeek={onPrevWeek}
                    onNextWeek={onNextWeek}
                    visibleStartIndex={visibleStartIndex}
                  />
                );
              })}

              {/* Placeholder at target position during move */}
              {isMoveDrag &&
                (() => {
                  const movedRow = eventRows.find(
                    (r) => r.event.id === allDayResizeState.eventId,
                  );
                  if (!movedRow) return null;
                  return (
                    <AllDayPlaceholderRow
                      event={movedRow.event}
                      startColumn={allDayResizeState.currentStartColumn}
                      endColumn={allDayResizeState.currentEndColumn}
                      row={movedRow.row}
                      totalColumns={days.length}
                    />
                  );
                })()}
            </div>
          </div>
        </div>
      </div>

      {/* Floating drag copy via portal */}
      {isMoveDrag &&
        allDayResizeState.clientX != null &&
        allDayResizeState.clientY != null &&
        (() => {
          const movedRow = eventRows.find(
            (r) => r.event.id === allDayResizeState.eventId,
          );
          if (!movedRow) return null;
          const span = movedRow.endColumn - movedRow.startColumn + 1;
          const colWidthPx = dayColumnWidth ?? 100;
          const floatingWidth = span * colWidthPx;
          const offsetX = allDayResizeState.cursorOffsetX ?? 0;

          return createPortal(
            <div
              className="pointer-events-none"
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100vw",
                height: "100vh",
                zIndex: 9999,
              }}
            >
              <div
                style={{
                  position: "fixed",
                  left: `${allDayResizeState.clientX - offsetX}px`,
                  top: `${allDayResizeState.clientY - (allDayResizeState.cursorOffsetY ?? 12)}px`,
                  width: `${floatingWidth}px`,
                }}
              >
                <AllDayEventItem
                  event={movedRow.event}
                  spanStart
                  spanEnd
                  dragVariant="dragging"
                />
              </div>
            </div>,
            document.body,
          );
        })()}
    </div>
  );
}

