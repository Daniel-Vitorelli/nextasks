"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AllDayResizeState,
  CalendarEvent,
} from "@/types/calendar";
import { clamp, DRAG_THRESHOLD_PX, TOUCH_SLOP_PX } from "@/lib/calendar/interaction";

interface UseAllDayResizeOptions {
  days: Date[];
  dayColumnWidth: number;
  allDayContainerRef: React.RefObject<HTMLDivElement | null>;
  events: CalendarEvent[];
  onEventChange?: (event: CalendarEvent) => void;
  onEventClick?: (event: CalendarEvent) => void;
}

interface UseAllDayResizeReturn {
  allDayResizeState: AllDayResizeState | null;
  handleAllDayResizePointerDown: (
    e: React.PointerEvent,
    event: CalendarEvent,
    edge: "left" | "right" | "move",
    startColumn: number,
    endColumn: number,
  ) => void;
}

interface ResizeInfo {
  eventId: string;
  event: CalendarEvent;
  edge: "left" | "right" | "move";
  pointerId: number;
  pointerType: string;
  startClientX: number;
  isResizing: boolean;
  originalStartColumn: number;
  originalEndColumn: number;
  /** Column index at the initial pointerdown position (used for move delta) */
  startColumnIndex: number;
  /** Offset from cursor to event left edge at pointerdown (px) */
  cursorOffsetX: number;
  /** Offset from cursor to event top edge at pointerdown (px) */
  cursorOffsetY: number;
}

export function useAllDayResize({
  days,
  dayColumnWidth,
  allDayContainerRef,
  events,
  onEventChange,
  onEventClick,
}: UseAllDayResizeOptions): UseAllDayResizeReturn {
  const [allDayResizeState, setAllDayResizeState] =
    useState<AllDayResizeState | null>(null);

  const resizeRef = useRef<ResizeInfo | null>(null);
  const onEventChangeRef = useRef(onEventChange);
  const onEventClickRef = useRef(onEventClick);
  const eventsRef = useRef(events);
  const daysRef = useRef(days);
  const dayColumnWidthRef = useRef(dayColumnWidth);

  useEffect(() => {
    onEventChangeRef.current = onEventChange;
  }, [onEventChange]);
  useEffect(() => {
    onEventClickRef.current = onEventClick;
  }, [onEventClick]);
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);
  useEffect(() => {
    daysRef.current = days;
  }, [days]);
  useEffect(() => {
    dayColumnWidthRef.current = dayColumnWidth;
  }, [dayColumnWidth]);

  const handlePointerMoveRef = useRef<((e: PointerEvent) => void) | null>(null);
  const handlePointerUpRef = useRef<((e: PointerEvent) => void) | null>(null);
  const handlePointerCancelRef = useRef<((e: PointerEvent) => void) | null>(
    null,
  );
  /** Blocks the browser's native scroll while a touch interaction is active. */
  const handleTouchMoveRef = useRef<((e: TouchEvent) => void) | null>(null);

  const cleanup = useCallback(() => {
    if (handlePointerMoveRef.current) {
      window.removeEventListener("pointermove", handlePointerMoveRef.current);
    }
    if (handlePointerUpRef.current) {
      window.removeEventListener("pointerup", handlePointerUpRef.current);
    }
    if (handlePointerCancelRef.current) {
      window.removeEventListener(
        "pointercancel",
        handlePointerCancelRef.current,
      );
    }
    if (handleTouchMoveRef.current) {
      window.removeEventListener("touchmove", handleTouchMoveRef.current);
    }
    document.body.style.removeProperty("--cursor");
  }, []);

  useEffect(() => {
    handlePointerMoveRef.current = (e: PointerEvent) => {
      const resize = resizeRef.current;
      if (!resize) return;

      const deltaX = Math.abs(e.clientX - resize.startClientX);
      const slop =
        resize.pointerType === "mouse" ? DRAG_THRESHOLD_PX : TOUCH_SLOP_PX;
      if (!resize.isResizing && deltaX < slop) return;

      if (!resize.isResizing) {
        resize.isResizing = true;
        document.body.style.setProperty(
          "--cursor",
          resize.edge === "move" ? "grabbing" : "col-resize",
        );
      }

      const container = allDayContainerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const colWidth = dayColumnWidthRef.current;
      const currentDays = daysRef.current;
      const columnIndex = clamp(
        Math.floor((e.clientX - rect.left) / colWidth),
        0,
        currentDays.length - 1,
      );

      let newStartColumn = resize.originalStartColumn;
      let newEndColumn = resize.originalEndColumn;

      if (resize.edge === "move") {
        const span = resize.originalEndColumn - resize.originalStartColumn;
        const delta = columnIndex - resize.startColumnIndex;
        newStartColumn = clamp(
          resize.originalStartColumn + delta,
          0,
          currentDays.length - 1 - span,
        );
        newEndColumn = newStartColumn + span;
      } else if (resize.edge === "right") {
        newEndColumn = Math.max(columnIndex, resize.originalStartColumn);
      } else {
        newStartColumn = Math.min(columnIndex, resize.originalEndColumn);
      }

      setAllDayResizeState({
        eventId: resize.eventId,
        event: resize.event,
        originalStartColumn: resize.originalStartColumn,
        originalEndColumn: resize.originalEndColumn,
        currentStartColumn: newStartColumn,
        currentEndColumn: newEndColumn,
        edge: resize.edge,
        isResizing: true,
        ...(resize.edge === "move"
          ? {
              clientX: e.clientX,
              clientY: e.clientY,
              cursorOffsetX: resize.cursorOffsetX,
              cursorOffsetY: resize.cursorOffsetY,
            }
          : {}),
      });
    };

    handlePointerUpRef.current = (e: PointerEvent) => {
      const resize = resizeRef.current;
      if (!resize) return;

      // Ignore unrelated pointer releases (e.g. a second finger lifting).
      if (e.pointerId !== resize.pointerId) return;

      cleanup();

      if (resize.isResizing) {
        setAllDayResizeState((prev) => {
          if (!prev) return null;

          const event = eventsRef.current.find((e) => e.id === resize.eventId);
          if (!event) return null;

          const currentDays = daysRef.current;
          const newStartDate = currentDays[prev.currentStartColumn];
          const newEndDate = currentDays[prev.currentEndColumn];

          if (!newStartDate || !newEndDate) return null;

          // Preserve time-of-day from original event
          const newStart = new Date(newStartDate);
          newStart.setHours(
            event.start.getHours(),
            event.start.getMinutes(),
            event.start.getSeconds(),
            event.start.getMilliseconds(),
          );

          const newEnd = new Date(newEndDate);
          newEnd.setHours(
            event.end.getHours(),
            event.end.getMinutes(),
            event.end.getSeconds(),
            event.end.getMilliseconds(),
          );

          // Move preserves the original isAllDay flag (duration unchanged).
          // Resize determines isAllDay by whether the span exceeds 24h.
          const isMove = resize.edge === "move";
          const MS_IN_24H = 24 * 60 * 60 * 1000;
          const isLongerThan24h =
            newEnd.getTime() - newStart.getTime() > MS_IN_24H;
          const isAllDay = isMove ? event.isAllDay === true : isLongerThan24h;

          onEventChangeRef.current?.({
            ...event,
            start: newStart,
            end: newEnd,
            isAllDay,
          });

          return null;
        });
      } else {
        setAllDayResizeState(null);
      }

      resizeRef.current = null;
    };

    // If the browser takes over the gesture (touch scroll), abort.
    handlePointerCancelRef.current = () => {
      const resize = resizeRef.current;
      if (!resize) return;

      cleanup();
      setAllDayResizeState(null);
      resizeRef.current = null;
    };

    // All-day interactions start on touch immediately, so block the native
    // scroll for the whole gesture.
    handleTouchMoveRef.current = (e: TouchEvent) => {
      if (resizeRef.current && e.cancelable) {
        e.preventDefault();
      }
    };
  }, [allDayContainerRef, cleanup]);

  const handleAllDayResizePointerDown = useCallback(
    (
      e: React.PointerEvent,
      event: CalendarEvent,
      edge: "left" | "right" | "move",
      startColumn: number,
      endColumn: number,
    ) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;

      e.stopPropagation();

      onEventClickRef.current?.(event);

      // Compute the column under the cursor at pointerdown for move delta
      const container = allDayContainerRef.current;
      let startColumnIndex = startColumn;
      let cursorOffsetX = 0;
      const cursorOffsetY = 0;
      if (container) {
        const rect = container.getBoundingClientRect();
        const colWidth = dayColumnWidthRef.current;
        startColumnIndex = clamp(
          Math.floor((e.clientX - rect.left) / colWidth),
          0,
          daysRef.current.length - 1,
        );
        // Compute offset from cursor to the event element's top-left
        const eventLeft = rect.left + startColumn * colWidth;
        cursorOffsetX = e.clientX - eventLeft;
      }

      resizeRef.current = {
        eventId: event.id,
        event,
        edge,
        pointerId: e.pointerId,
        pointerType: e.pointerType,
        startClientX: e.clientX,
        isResizing: false,
        originalStartColumn: startColumn,
        originalEndColumn: endColumn,
        startColumnIndex,
        cursorOffsetX,
        cursorOffsetY,
      };

      setAllDayResizeState({
        eventId: event.id,
        event,
        originalStartColumn: startColumn,
        originalEndColumn: endColumn,
        currentStartColumn: startColumn,
        currentEndColumn: endColumn,
        edge,
        isResizing: false,
      });

      if (handlePointerMoveRef.current) {
        window.addEventListener("pointermove", handlePointerMoveRef.current);
      }
      if (handlePointerUpRef.current) {
        window.addEventListener("pointerup", handlePointerUpRef.current);
      }
      if (handlePointerCancelRef.current) {
        window.addEventListener(
          "pointercancel",
          handlePointerCancelRef.current,
        );
      }
      if (handleTouchMoveRef.current) {
        window.addEventListener("touchmove", handleTouchMoveRef.current, {
          passive: false,
        });
      }
    },
    [allDayContainerRef],
  );

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return { allDayResizeState, handleAllDayResizePointerDown };
}
