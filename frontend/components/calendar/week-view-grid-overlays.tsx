"use client";

import { createPortal } from "react-dom";
import { addDays, isSameDay, startOfDay } from "date-fns";

import { CalendarEventItem } from "./calendar-event-item";
import type {
  EventDragState,
  EventResizeState,
  PositionedEvent,
} from "@/types/calendar";
import type { WeekViewGridProps } from "./week-view-types";

interface DragPlaceholderOverlayProps {
  days: WeekViewGridProps["days"];
  hourHeight: number;
  dragState: EventDragState;
}

function DragPlaceholderOverlay({
  days,
  hourHeight,
  dragState,
}: DragPlaceholderOverlayProps) {
  // Find the target column index using dragState.currentDate
  const targetColumnIndex = days.findIndex((d) =>
    isSameDay(d.date, dragState.currentDate),
  );

  if (targetColumnIndex === -1) return null;

  // Build a minimal PositionedEvent from the drag state event
  const placeholderPositioned: PositionedEvent = {
    event: dragState.event,
    top: 0,
    height: 0,
    left: 0,
    width: 92,
    column: 0,
    totalColumns: 1,
  };

  return (
    <div
      className="absolute inset-0 grid pointer-events-none"
      style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}
    >
      {days.map((day, i) => {
        if (i !== targetColumnIndex) {
          return <div key={day.date.toISOString()} />;
        }

        return (
          <div key={day.date.toISOString()} className="relative">
            <CalendarEventItem
              key={`${dragState.eventId}-placeholder`}
              positionedEvent={placeholderPositioned}
              hourHeight={hourHeight}
              dragVariant="placeholder"
              overrideStart={dragState.currentStart}
              overrideEnd={dragState.currentEnd}
            />
          </div>
        );
      })}
    </div>
  );
}

interface ResizePlaceholderOverlayProps {
  days: WeekViewGridProps["days"];
  hourHeight: number;
  resizeState: EventResizeState;
}

function ResizePlaceholderOverlay({
  days,
  hourHeight,
  resizeState,
}: ResizePlaceholderOverlayProps) {
  if (resizeState.effectiveEdge === "bottom") {
    return (
      <BottomEdgeOverlay
        days={days}
        hourHeight={hourHeight}
        resizeState={resizeState}
      />
    );
  }

  return (
    <TopEdgeOverlay
      days={days}
      hourHeight={hourHeight}
      resizeState={resizeState}
    />
  );
}

function BottomEdgeOverlay({
  days,
  hourHeight,
  resizeState,
}: ResizePlaceholderOverlayProps) {
  const endDay = resizeState.currentEndDate;

  const startColIndex = days.findIndex((d) =>
    isSameDay(d.date, resizeState.currentStartDate),
  );
  const endColIndex = days.findIndex((d) => isSameDay(d.date, endDay));

  if (startColIndex === -1 || endColIndex === -1) return null;
  if (endColIndex <= startColIndex) return null;

  return (
    <div
      className="absolute inset-0 grid pointer-events-none"
      style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}
    >
      {days.map((day, i) => {
        // Skip start column (handled by DayEventsColumn) and columns outside range
        if (i <= startColIndex || i > endColIndex) {
          return <div key={day.date.toISOString()} />;
        }

        const isEndColumn = i === endColIndex;
        const segmentPosition = isEndColumn
          ? ("end" as const)
          : ("middle" as const);

        const midnight = startOfDay(day.date);
        const overrideStart = midnight;
        const overrideEnd = isEndColumn
          ? resizeState.currentEnd
          : addDays(midnight, 1);

        const positioned: PositionedEvent = {
          event: resizeState.event,
          top: 0,
          height: 0,
          left: 0,
          width: 92,
          column: 0,
          totalColumns: 1,
          segmentPosition,
        };

        return (
          <div key={day.date.toISOString()} className="relative">
            <CalendarEventItem
              positionedEvent={positioned}
              hourHeight={hourHeight}
              isSelected
              overrideStart={overrideStart}
              overrideEnd={overrideEnd}
            />
          </div>
        );
      })}
    </div>
  );
}

function TopEdgeOverlay({
  days,
  hourHeight,
  resizeState,
}: ResizePlaceholderOverlayProps) {
  const startDay = resizeState.currentStartDate;

  const startColIndex = days.findIndex((d) => isSameDay(d.date, startDay));
  const endColIndex = days.findIndex((d) =>
    isSameDay(d.date, resizeState.currentEndDate),
  );

  if (startColIndex === -1 || endColIndex === -1) return null;
  if (endColIndex <= startColIndex) return null;

  return (
    <div
      className="absolute inset-0 grid pointer-events-none"
      style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}
    >
      {days.map((day, i) => {
        // Skip end column (handled by DayEventsColumn) and columns outside range
        if (i < startColIndex || i >= endColIndex) {
          return <div key={day.date.toISOString()} />;
        }

        const isStartColumn = i === startColIndex;
        const segmentPosition = isStartColumn
          ? ("start" as const)
          : ("middle" as const);

        const midnight = startOfDay(day.date);
        const overrideStart = isStartColumn
          ? resizeState.currentStart
          : midnight;
        const overrideEnd = addDays(midnight, 1);

        const positioned: PositionedEvent = {
          event: resizeState.event,
          top: 0,
          height: 0,
          left: 0,
          width: 92,
          column: 0,
          totalColumns: 1,
          segmentPosition,
        };

        return (
          <div key={day.date.toISOString()} className="relative">
            <CalendarEventItem
              positionedEvent={positioned}
              hourHeight={hourHeight}
              isSelected
              overrideStart={overrideStart}
              overrideEnd={overrideEnd}
            />
          </div>
        );
      })}
    </div>
  );
}

interface FloatingDragCopyProps {
  days: WeekViewGridProps["days"];
  hourHeight: number;
  dragState: EventDragState;
  gridWidth: number;
}

function FloatingDragCopy({
  days,
  hourHeight,
  dragState,
  gridWidth,
}: FloatingDragCopyProps) {
  const floatingPositioned: PositionedEvent = {
    event: dragState.event,
    top: 0,
    height: 0,
    left: 0,
    width: 92,
    column: 0,
    totalColumns: 1,
  };

  const durationMinutes =
    (dragState.currentEnd.getTime() - dragState.currentStart.getTime()) / 60000;
  const heightPx = (durationMinutes / 60) * hourHeight;
  const columnWidthPx =
    (days.length > 0 ? gridWidth / days.length : 200) * 0.92;

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
      <CalendarEventItem
        key={`${dragState.eventId}-dragging`}
        positionedEvent={floatingPositioned}
        hourHeight={hourHeight}
        dragVariant="dragging"
        overrideStart={dragState.currentStart}
        overrideEnd={dragState.currentEnd}
        cursorY={dragState.clientY}
        cursorX={dragState.clientX}
        fixedWidth={columnWidthPx}
        fixedHeight={heightPx}
      />
    </div>,
    document.body,
  );
}

export function WeekViewGridOverlays({
  days,
  hourHeight,
  dragState,
  resizeState,
  gridWidth,
}: {
  days: WeekViewGridProps["days"];
  hourHeight: number;
  dragState: EventDragState | undefined;
  resizeState: EventResizeState | undefined;
  gridWidth: number;
}) {
  const isCrossDay =
    resizeState?.isResizing &&
    !isSameDay(resizeState.currentStartDate, resizeState.currentEndDate);

  return (
    <>
      {/* Resize placeholder overlay — rendered at grid level for cross-day support */}
      {isCrossDay && (
        <ResizePlaceholderOverlay
          days={days}
          hourHeight={hourHeight}
          resizeState={resizeState!}
        />
      )}

      {/* Drag placeholder overlay — rendered at grid level for cross-column support */}
      {dragState?.isDragging && (
        <DragPlaceholderOverlay
          days={days}
          hourHeight={hourHeight}
          dragState={dragState}
        />
      )}

      {/* Floating dragging copy — rendered at grid level so it can move freely */}
      {dragState?.isDragging && (
        <FloatingDragCopy
          days={days}
          hourHeight={hourHeight}
          dragState={dragState}
          gridWidth={gridWidth}
        />
      )}
    </>
  );
}