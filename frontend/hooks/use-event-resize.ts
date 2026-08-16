"use client";

import { isSameDay, startOfDay } from "date-fns";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CalendarEvent,
  EventResizeState,
} from "@/types/calendar";
import { useGridEdgeNavigation } from "./use-grid-edge-navigation";
import {
  addMinutesToDate,
  clamp,
  DRAG_THRESHOLD_PX,
  MIN_DURATION_MINUTES,
  snapToGrid,
  TOUCH_SLOP_PX,
} from "@/lib/calendar/interaction";

interface UseEventResizeOptions {
  hourHeight: number;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  events: CalendarEvent[];
  days: Date[];
  dayColumnWidth: number;
  timeAxisWidth: number;
  onEventChange?: (event: CalendarEvent) => void;
  onEventClick?: (event: CalendarEvent) => void;
  onResizeNavigate?: (daysDelta: number) => void;
}

interface UseEventResizeReturn {
  resizeState: EventResizeState | null;
  handleResizePointerDown: (
    e: React.PointerEvent,
    event: CalendarEvent,
    edge: "top" | "bottom",
  ) => void;
}

interface ResizeInfo {
  eventId: string;
  event: CalendarEvent;
  edge: "top" | "bottom";
  pointerId: number;
  pointerType: string;
  startClientY: number;
  isResizing: boolean;
  originalStartMinutes: number;
  originalEndMinutes: number;
  originalStartDate: Date;
  originalEndDate: Date;
}

export function useEventResize({
  hourHeight,
  scrollContainerRef,
  events,
  days,
  dayColumnWidth,
  timeAxisWidth,
  onEventChange,
  onEventClick,
  onResizeNavigate,
}: UseEventResizeOptions): UseEventResizeReturn {
  const [resizeState, setResizeState] = useState<EventResizeState | null>(null);

  const resizeRef = useRef<ResizeInfo | null>(null);
  const onEventChangeRef = useRef(onEventChange);
  const onEventClickRef = useRef(onEventClick);
  const onResizeNavigateRef = useRef(onResizeNavigate);
  const eventsRef = useRef(events);
  const hourHeightRef = useRef(hourHeight);
  const daysRef = useRef(days);
  const dayColumnWidthRef = useRef(dayColumnWidth);
  const timeAxisWidthRef = useRef(timeAxisWidth);

  useEffect(() => {
    onEventChangeRef.current = onEventChange;
  }, [onEventChange]);
  useEffect(() => {
    onEventClickRef.current = onEventClick;
  }, [onEventClick]);
  useEffect(() => {
    onResizeNavigateRef.current = onResizeNavigate;
  }, [onResizeNavigate]);
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);
  useEffect(() => {
    hourHeightRef.current = hourHeight;
  }, [hourHeight]);
  useEffect(() => {
    daysRef.current = days;
  }, [days]);
  useEffect(() => {
    dayColumnWidthRef.current = dayColumnWidth;
  }, [dayColumnWidth]);
  useEffect(() => {
    timeAxisWidthRef.current = timeAxisWidth;
  }, [timeAxisWidth]);

  const { updateForCursor, stop: stopGridNavigation } = useGridEdgeNavigation(
    scrollContainerRef,
    (daysDelta) => onResizeNavigateRef.current?.(daysDelta),
  );

  const handlePointerMoveRef = useRef<((e: PointerEvent) => void) | null>(null);
  const handlePointerUpRef = useRef<((e: PointerEvent) => void) | null>(null);
  const handlePointerCancelRef = useRef<((e: PointerEvent) => void) | null>(
    null,
  );
  /** Blocks the browser's native scroll while a touch resize is active. */
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
    stopGridNavigation();
  }, [stopGridNavigation]);

  useEffect(() => {
    handlePointerMoveRef.current = (e: PointerEvent) => {
      const resize = resizeRef.current;
      if (!resize) return;

      const deltaY = Math.abs(e.clientY - resize.startClientY);
      const slop =
        resize.pointerType === "mouse" ? DRAG_THRESHOLD_PX : TOUCH_SLOP_PX;
      if (!resize.isResizing && deltaY < slop) return;

      if (!resize.isResizing) {
        resize.isResizing = true;
      }

      const container = scrollContainerRef.current;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const scrollTop = container.scrollTop;
      const absoluteY = e.clientY - containerRect.top + scrollTop;
      const rawMinutes = (absoluteY / hourHeightRef.current) * 60;
      const snappedMinutes = snapToGrid(rawMinutes);

      let newStartMinutes = resize.originalStartMinutes;
      let newEndMinutes = resize.originalEndMinutes;
      let startDate = resize.originalStartDate;
      let endDate = resize.originalEndDate;

      // Column detection (shared for both edges)
      const colWidth = dayColumnWidthRef.current;
      const visibleDays = daysRef.current;
      const gridLeftEdge = containerRect.left + timeAxisWidthRef.current;
      const cursorInGrid = e.clientX - gridLeftEdge;
      const columnIndex = clamp(
        Math.floor(cursorInGrid / colWidth),
        0,
        visibleDays.length - 1,
      );
      const targetDay = visibleDays[columnIndex];

      // Unified anchor model: anchor is the opposite end of the grabbed edge
      const anchorDate =
        resize.edge === "bottom"
          ? resize.originalStartDate
          : resize.originalEndDate;
      const anchorMinutes =
        resize.edge === "bottom"
          ? resize.originalStartMinutes
          : resize.originalEndMinutes;

      const cursorTimestamp = targetDay.getTime() + snappedMinutes * 60000;
      const anchorTimestamp = anchorDate.getTime() + anchorMinutes * 60000;

      let effectiveEdge: "top" | "bottom";

      if (cursorTimestamp > anchorTimestamp) {
        // Cursor is after anchor → effective bottom
        effectiveEdge = "bottom";
        startDate = anchorDate;
        newStartMinutes = anchorMinutes;
        endDate = targetDay;
        newEndMinutes = clamp(snappedMinutes, 0, 1440);

        // Cross-day edge case: cursor at minute 0 on day right after anchor → treat as end-of-anchor-day
        if (!isSameDay(targetDay, anchorDate)) {
          const dayAfterAnchor = new Date(anchorDate);
          dayAfterAnchor.setDate(dayAfterAnchor.getDate() + 1);
          dayAfterAnchor.setHours(0, 0, 0, 0);

          if (isSameDay(targetDay, dayAfterAnchor) && snappedMinutes === 0) {
            newEndMinutes = 1440;
            endDate = anchorDate;
          }
        }

        // Same-day: enforce min duration
        if (isSameDay(startDate, endDate)) {
          newEndMinutes = clamp(
            newEndMinutes,
            anchorMinutes + MIN_DURATION_MINUTES,
            1440,
          );
        }
      } else if (cursorTimestamp < anchorTimestamp) {
        // Cursor is before anchor → effective top
        effectiveEdge = "top";
        endDate = anchorDate;
        newEndMinutes = anchorMinutes;
        startDate = targetDay;
        newStartMinutes = clamp(snappedMinutes, 0, 1440);

        // Cross-day edge case: cursor at minute 1440 on day right before anchor → treat as start-of-anchor-day
        if (!isSameDay(targetDay, anchorDate)) {
          const dayBeforeAnchor = new Date(anchorDate);
          dayBeforeAnchor.setDate(dayBeforeAnchor.getDate() - 1);
          dayBeforeAnchor.setHours(0, 0, 0, 0);

          if (isSameDay(targetDay, dayBeforeAnchor) && snappedMinutes >= 1440) {
            newStartMinutes = 0;
            startDate = anchorDate;
          }
        }

        // Same-day: enforce min duration
        if (isSameDay(startDate, endDate)) {
          newStartMinutes = clamp(
            newStartMinutes,
            0,
            anchorMinutes - MIN_DURATION_MINUTES,
          );
        }
      } else {
        // Cursor at anchor → keep minimum duration in original edge direction (no flip)
        effectiveEdge = resize.edge;
        if (resize.edge === "bottom") {
          startDate = anchorDate;
          newStartMinutes = anchorMinutes;
          endDate = anchorDate;
          newEndMinutes = anchorMinutes + MIN_DURATION_MINUTES;
        } else {
          endDate = anchorDate;
          newEndMinutes = anchorMinutes;
          startDate = anchorDate;
          newStartMinutes = anchorMinutes - MIN_DURATION_MINUTES;
        }
      }

      const currentStart = addMinutesToDate(startDate, newStartMinutes);
      const currentEnd = addMinutesToDate(endDate, newEndMinutes);

      setResizeState({
        eventId: resize.eventId,
        event: resize.event,
        originalStart: resize.event.start,
        originalEnd: resize.event.end,
        currentStart,
        currentEnd,
        edge: resize.edge,
        effectiveEdge,
        isResizing: true,
        currentEndDate: endDate,
        currentStartDate: startDate,
      });

      // Auto-scroll + edge-of-view week navigation
      const cursorYInContainer = e.clientY - containerRect.top;
      const containerHeight = containerRect.height;
      const cursorXInGrid = e.clientX - gridLeftEdge;
      const gridWidth = colWidth * visibleDays.length;

      updateForCursor({ cursorXInGrid, gridWidth, cursorYInContainer, containerHeight });
    };

    handlePointerUpRef.current = (e: PointerEvent) => {
      const resize = resizeRef.current;
      if (!resize) return;

      // Ignore unrelated pointer releases (e.g. a second finger lifting).
      if (e.pointerId !== resize.pointerId) return;

      cleanup();

      if (resize.isResizing) {
        setResizeState((prev) => {
          if (!prev) return null;

          const event = eventsRef.current.find((e) => e.id === resize.eventId);
          if (!event) return null;

          const MS_IN_24H = 24 * 60 * 60 * 1000;
          const isLongerThan24h =
            prev.currentEnd.getTime() - prev.currentStart.getTime() > MS_IN_24H;

          onEventChangeRef.current?.({
            ...event,
            start: prev.currentStart,
            end: prev.currentEnd,
            isAllDay: isLongerThan24h,
          });

          return null;
        });
      } else {
        setResizeState(null);
      }

      resizeRef.current = null;
    };

    // If the browser takes over the gesture (touch scroll), abort the resize.
    handlePointerCancelRef.current = () => {
      const resize = resizeRef.current;
      if (!resize) return;

      cleanup();
      setResizeState(null);
      resizeRef.current = null;
    };

    // A resize starts on touch immediately, so block the native scroll for
    // the whole gesture (the user explicitly grabbed an edge handle).
    handleTouchMoveRef.current = (e: TouchEvent) => {
      if (resizeRef.current && e.cancelable) {
        e.preventDefault();
      }
    };
  }, [
    scrollContainerRef,
    cleanup,
    updateForCursor,
  ]);

  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent, event: CalendarEvent, edge: "top" | "bottom") => {
      if (e.pointerType === "mouse" && e.button !== 0) return;

      e.stopPropagation();

      onEventClickRef.current?.(event);

      const originalStartMinutes =
        event.start.getHours() * 60 + event.start.getMinutes();
      const originalEndMinutes =
        event.end.getHours() * 60 + event.end.getMinutes();

      const originalStartDate = startOfDay(event.start);
      const originalEndDate = startOfDay(event.end);

      resizeRef.current = {
        eventId: event.id,
        event,
        edge,
        pointerId: e.pointerId,
        pointerType: e.pointerType,
        startClientY: e.clientY,
        isResizing: false,
        originalStartMinutes,
        originalEndMinutes,
        originalStartDate,
        originalEndDate,
      };

      setResizeState({
        eventId: event.id,
        event,
        originalStart: event.start,
        originalEnd: event.end,
        currentStart: event.start,
        currentEnd: event.end,
        edge,
        effectiveEdge: edge,
        isResizing: false,
        currentEndDate: originalEndDate,
        currentStartDate: originalStartDate,
      });

      if (handlePointerMoveRef.current) {
        window.addEventListener(
          "pointermove",
          handlePointerMoveRef.current,
        );
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
    [],
  );

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return { resizeState, handleResizePointerDown };
}
