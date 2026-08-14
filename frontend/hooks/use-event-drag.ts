"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CalendarEvent,
  EventDragState,
} from "@/components/calendar/week-view-types";

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

const DRAG_THRESHOLD_PX = 4;
/** Movement needed for a finger drag to start (mouse uses DRAG_THRESHOLD_PX). */
const TOUCH_SLOP_PX = 10;
const SNAP_MINUTES = 15;
const EDGE_ZONE_PX = 40;
const EDGE_NAV_DELAY_MS = 500;
const EDGE_NAV_REPEAT_MS = 800;
const AUTO_SCROLL_ZONE_PX = 60;
const AUTO_SCROLL_MAX_SPEED = 12;

function snapToGrid(minutes: number): number {
  return Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;
}

function addMinutesToDate(date: Date, minutes: number): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  result.setMinutes(minutes);
  return result;
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
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

  // Edge navigation timer refs
  const edgeNavTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const edgeNavDirectionRef = useRef<number | null>(null);

  // Auto-scroll RAF ref
  const autoScrollRAFRef = useRef<number | null>(null);
  const autoScrollSpeedRef = useRef(0);

  // Store handlers in refs to break the circular dependency
  const handlePointerMoveRef = useRef<((e: PointerEvent) => void) | null>(null);
  const handlePointerUpRef = useRef<((e: PointerEvent) => void) | null>(null);
  const handlePointerCancelRef = useRef<((e: PointerEvent) => void) | null>(
    null,
  );
  /** Blocks the browser's native scroll while a touch drag is active. */
  const handleTouchMoveRef = useRef<((e: TouchEvent) => void) | null>(null);

  const cancelEdgeNav = useCallback(() => {
    if (edgeNavTimerRef.current !== null) {
      clearTimeout(edgeNavTimerRef.current);
      edgeNavTimerRef.current = null;
    }
    edgeNavDirectionRef.current = null;
  }, []);

  const cancelAutoScroll = useCallback(() => {
    if (autoScrollRAFRef.current !== null) {
      cancelAnimationFrame(autoScrollRAFRef.current);
      autoScrollRAFRef.current = null;
    }
    autoScrollSpeedRef.current = 0;
  }, []);

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
    cancelEdgeNav();
    cancelAutoScroll();
  }, [cancelEdgeNav, cancelAutoScroll]);

  // Auto-scroll loop
  const startAutoScrollLoop = useCallback(() => {
    if (autoScrollRAFRef.current !== null) return;

    const tick = () => {
      const container = scrollContainerRef.current;
      if (!container) return;

      const speed = autoScrollSpeedRef.current;
      if (speed === 0) {
        autoScrollRAFRef.current = null;
        return;
      }

      container.scrollTop += speed;
      autoScrollRAFRef.current = requestAnimationFrame(tick);
    };

    autoScrollRAFRef.current = requestAnimationFrame(tick);
  }, [scrollContainerRef]);

  const scheduleEdgeNav = useCallback(
    (direction: number) => {
      if (edgeNavDirectionRef.current === direction) return;

      cancelEdgeNav();
      edgeNavDirectionRef.current = direction;

      const fireNav = () => {
        onDragNavigateRef.current?.(direction);
        edgeNavTimerRef.current = setTimeout(fireNav, EDGE_NAV_REPEAT_MS);
      };

      edgeNavTimerRef.current = setTimeout(fireNav, EDGE_NAV_DELAY_MS);
    },
    [cancelEdgeNav],
  );

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
      const clampedStart = Math.max(
        0,
        Math.min(snappedStartMinutes, 1440 - drag.durationMinutes),
      );

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

      // Edge-of-view week navigation
      // Trigger when cursor is within EDGE_ZONE_PX of the grid boundary OR past it
      const cursorXInGrid = e.clientX - gridLeftEdge;
      const gridWidth = colWidth * visibleDays.length;

      if (cursorXInGrid < EDGE_ZONE_PX) {
        scheduleEdgeNav(-7);
      } else if (cursorXInGrid > gridWidth - EDGE_ZONE_PX) {
        scheduleEdgeNav(7);
      } else {
        cancelEdgeNav();
      }

      // Auto-scroll at top/bottom edges
      const cursorYInContainer = e.clientY - containerRect.top;
      const containerHeight = containerRect.height;

      if (cursorYInContainer < AUTO_SCROLL_ZONE_PX) {
        const dist = cursorYInContainer;
        autoScrollSpeedRef.current =
          -AUTO_SCROLL_MAX_SPEED * (1 - dist / AUTO_SCROLL_ZONE_PX);
        startAutoScrollLoop();
      } else if (cursorYInContainer > containerHeight - AUTO_SCROLL_ZONE_PX) {
        const dist = containerHeight - cursorYInContainer;
        autoScrollSpeedRef.current =
          AUTO_SCROLL_MAX_SPEED * (1 - dist / AUTO_SCROLL_ZONE_PX);
        startAutoScrollLoop();
      } else {
        cancelAutoScroll();
      }
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
    scheduleEdgeNav,
    cancelEdgeNav,
    cancelAutoScroll,
    startAutoScrollLoop,
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
