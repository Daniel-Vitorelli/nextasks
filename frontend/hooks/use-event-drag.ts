"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CalendarEvent,
  EventDragState,
} from "@/types/calendar";
import { useGridEdgeNavigation } from "./use-grid-edge-navigation";
import {
  addMinutesToDate,
  clamp,
  DRAG_THRESHOLD_PX,
  snapToGrid,
  TOUCH_SLOP_PX,
} from "@/lib/calendar/interaction";

interface UseEventDragOptions {
  hourHeight: number;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  events: CalendarEvent[];
  days: Date[];
  dayColumnWidth: number;
  timeAxisWidth: number;
  onEventChange?: (event: CalendarEvent) => void;
  onEventClick?: (event: CalendarEvent) => void;
  onDragNavigate?: (daysDelta: number) => void;
}

interface UseEventDragReturn {
  dragState: EventDragState | null;
  handleEventPointerDown: (
    e: React.PointerEvent,
    event: CalendarEvent,
    targetEl?: HTMLElement,
  ) => void;
}

interface DragInfo {
  eventId: string;
  event: CalendarEvent;
  pointerId: number;
  pointerType: string;
  startClientY: number;
  startClientX: number;
  offsetWithinEvent: number;
  offsetWithinEventX: number;
  isDragging: boolean;
  durationMinutes: number;
}

export function useEventDrag({
  hourHeight,
  scrollContainerRef,
  events,
  days,
  dayColumnWidth,
  timeAxisWidth,
  onEventChange,
  onEventClick,
  onDragNavigate,
}: UseEventDragOptions): UseEventDragReturn {
  const [dragState, setDragState] = useState<EventDragState | null>(null);

  const dragRef = useRef<DragInfo | null>(null);
  const onEventChangeRef = useRef(onEventChange);
  const onEventClickRef = useRef(onEventClick);
  const onDragNavigateRef = useRef(onDragNavigate);
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
    onDragNavigateRef.current = onDragNavigate;
  }, [onDragNavigate]);
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

  // Edge-of-view week navigation + vertical auto-scroll during the drag
  const { updateForCursor, stop: stopGridNavigation } = useGridEdgeNavigation(
    scrollContainerRef,
    (daysDelta) => onDragNavigateRef.current?.(daysDelta),
  );

  // Store handlers in refs to break the circular dependency
  const handlePointerMoveRef = useRef<((e: PointerEvent) => void) | null>(null);
  const handlePointerUpRef = useRef<((e: PointerEvent) => void) | null>(null);
  const handlePointerCancelRef = useRef<((e: PointerEvent) => void) | null>(
    null,
  );
  /** Blocks the browser's native scroll while a touch drag is active. */
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

  // Initialize the handlers once (stable references via refs)
  useEffect(() => {
    handlePointerMoveRef.current = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      const deltaY = Math.abs(e.clientY - drag.startClientY);
      const deltaX = Math.abs(e.clientX - drag.startClientX);
      const slop =
        drag.pointerType === "mouse" ? DRAG_THRESHOLD_PX : TOUCH_SLOP_PX;
      if (!drag.isDragging && deltaY < slop && deltaX < slop) return;

      if (!drag.isDragging) {
        drag.isDragging = true;
      }

      const container = scrollContainerRef.current;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const scrollTop = container.scrollTop;
      const absoluteY =
        e.clientY - containerRect.top + scrollTop - drag.offsetWithinEvent;
      const absoluteX =
        e.clientX - containerRect.left - drag.offsetWithinEventX;
      const rawMinutes = (absoluteY / hourHeightRef.current) * 60;
      const snappedStartMinutes = snapToGrid(rawMinutes);
      const clampedStart = clamp(snappedStartMinutes, 0, 1440 - drag.durationMinutes);

      // Column detection — based on raw cursor position over the grid
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

      const currentStart = addMinutesToDate(targetDay, clampedStart);
      const currentEnd = addMinutesToDate(
        targetDay,
        clampedStart + drag.durationMinutes,
      );

      setDragState({
        eventId: drag.eventId,
        event: drag.event,
        originalStart: drag.event.start,
        originalEnd: drag.event.end,
        currentStart,
        currentEnd,
        currentDate: targetDay,
        isDragging: true,
        cursorY: absoluteY,
        cursorX: absoluteX,
        clientX: e.clientX - drag.offsetWithinEventX,
        clientY: e.clientY - drag.offsetWithinEvent,
      });

      // Edge-of-view week navigation + auto-scroll at top/bottom edges
      const cursorYInContainer = e.clientY - containerRect.top;
      const containerHeight = containerRect.height;
      const cursorXInGrid = e.clientX - gridLeftEdge;
      const gridWidth = colWidth * visibleDays.length;

      updateForCursor({ cursorXInGrid, gridWidth, cursorYInContainer, containerHeight });
    };

    handlePointerUpRef.current = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      // Ignore unrelated pointer releases (e.g. a second finger lifting).
      if (e.pointerId !== drag.pointerId) return;

      cleanup();

      if (drag.isDragging) {
        setDragState((prev) => {
          if (!prev) return null;

          const event = eventsRef.current.find((e) => e.id === drag.eventId);
          if (!event) return null;

          onEventChangeRef.current?.({
            ...event,
            start: prev.currentStart,
            end: prev.currentEnd,
          });

          return null;
        });
      } else {
        setDragState(null);
      }

      dragRef.current = null;
    };

    // If the browser takes over the gesture (touch scroll), abort the drag.
    handlePointerCancelRef.current = () => {
      const drag = dragRef.current;
      if (!drag) return;

      cleanup();
      setDragState(null);
      dragRef.current = null;
    };

    // Only blocks the native scroll once the drag actually moved the event;
    // before that the finger is free to scroll the grid.
    handleTouchMoveRef.current = (e: TouchEvent) => {
      if (dragRef.current?.isDragging && e.cancelable) {
        e.preventDefault();
      }
    };
  }, [
    scrollContainerRef,
    cleanup,
    updateForCursor,
  ]);

  const handleEventPointerDown = useCallback(
    (
      e: React.PointerEvent,
      event: CalendarEvent,
      targetEl?: HTMLElement,
    ) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;

      // Select the event immediately
      onEventClickRef.current?.(event);

      const container = scrollContainerRef.current;
      if (!container) return;

      // Compute offset within the event element. The element is passed
      // explicitly because delayed initiators (touch long-press) run after
      // the event dispatch, when currentTarget is no longer available.
      const target = targetEl ?? (e.currentTarget as HTMLElement | null);
      if (!target) return;
      const targetRect = target.getBoundingClientRect();
      const offsetWithinEvent = e.clientY - targetRect.top;
      const offsetWithinEventX = e.clientX - targetRect.left;

      const startMinutes =
        event.start.getHours() * 60 + event.start.getMinutes();
      const endMinutes = event.end.getHours() * 60 + event.end.getMinutes();
      const durationMinutes = endMinutes - startMinutes;

      dragRef.current = {
        eventId: event.id,
        event,
        pointerId: e.pointerId,
        pointerType: e.pointerType,
        startClientY: e.clientY,
        startClientX: e.clientX,
        offsetWithinEvent,
        offsetWithinEventX,
        isDragging: false,
        durationMinutes,
      };

      setDragState({
        eventId: event.id,
        event,
        originalStart: event.start,
        originalEnd: event.end,
        currentStart: event.start,
        currentEnd: event.end,
        currentDate: event.start,
        isDragging: false,
        cursorY: 0,
        cursorX: 0,
        clientX: 0,
        clientY: 0,
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
    [scrollContainerRef],
  );

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return { dragState, handleEventPointerDown };
}
