"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  AUTO_SCROLL_MAX_SPEED,
  AUTO_SCROLL_ZONE_PX,
  EDGE_NAV_DELAY_MS,
  EDGE_NAV_REPEAT_MS,
  EDGE_ZONE_PX,
} from "@/lib/calendar/interaction";

interface UpdateForCursorParams {
  /** Cursor X relative to the left edge of the grid (past the time axis). */
  cursorXInGrid: number;
  /** Total width of the grid in pixels. */
  gridWidth: number;
  /** Cursor Y relative to the top of the scroll container. */
  cursorYInContainer: number;
  /** Visible height of the scroll container in pixels. */
  containerHeight: number;
}

/**
 * Shared gesture helpers for drag/resize: week navigation when the cursor
 * reaches the horizontal edges and auto-scroll when it reaches the vertical
 * edges of the scroll container.
 */
export function useGridEdgeNavigation(
  scrollContainerRef: React.RefObject<HTMLDivElement | null>,
  onNavigate: (daysDelta: number) => void,
) {
  const onNavigateRef = useRef(onNavigate);
  useEffect(() => {
    onNavigateRef.current = onNavigate;
  }, [onNavigate]);

  const edgeNavTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const edgeNavDirectionRef = useRef<number | null>(null);

  const autoScrollRAFRef = useRef<number | null>(null);
  const autoScrollSpeedRef = useRef(0);

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

  const scheduleEdgeNav = useCallback(
    (direction: number) => {
      if (edgeNavDirectionRef.current === direction) return;

      cancelEdgeNav();
      edgeNavDirectionRef.current = direction;

      const fireNav = () => {
        onNavigateRef.current?.(direction);
        edgeNavTimerRef.current = setTimeout(fireNav, EDGE_NAV_REPEAT_MS);
      };

      edgeNavTimerRef.current = setTimeout(fireNav, EDGE_NAV_DELAY_MS);
    },
    [cancelEdgeNav],
  );

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

  const setAutoScrollSpeed = useCallback((speed: number) => {
    autoScrollSpeedRef.current = speed;
  }, []);

  /**
   * Applies edge navigation and auto-scroll for a single cursor position.
   * Call on every pointer move during the gesture.
   */
  const updateForCursor = useCallback(
    ({
      cursorXInGrid,
      gridWidth,
      cursorYInContainer,
      containerHeight,
    }: UpdateForCursorParams) => {
      if (cursorXInGrid < EDGE_ZONE_PX) {
        scheduleEdgeNav(-7);
      } else if (cursorXInGrid > gridWidth - EDGE_ZONE_PX) {
        scheduleEdgeNav(7);
      } else {
        cancelEdgeNav();
      }

      if (cursorYInContainer < AUTO_SCROLL_ZONE_PX) {
        const dist = cursorYInContainer;
        setAutoScrollSpeed(
          -AUTO_SCROLL_MAX_SPEED * (1 - dist / AUTO_SCROLL_ZONE_PX),
        );
        startAutoScrollLoop();
      } else if (cursorYInContainer > containerHeight - AUTO_SCROLL_ZONE_PX) {
        const dist = containerHeight - cursorYInContainer;
        setAutoScrollSpeed(
          AUTO_SCROLL_MAX_SPEED * (1 - dist / AUTO_SCROLL_ZONE_PX),
        );
        startAutoScrollLoop();
      } else {
        cancelAutoScroll();
      }
    },
    [
      scheduleEdgeNav,
      cancelEdgeNav,
      setAutoScrollSpeed,
      startAutoScrollLoop,
      cancelAutoScroll,
    ],
  );

  /** Cancels every active timer/loop. Call on gesture end or unmount. */
  const stop = useCallback(() => {
    cancelEdgeNav();
    cancelAutoScroll();
  }, [cancelEdgeNav, cancelAutoScroll]);

  return { updateForCursor, stop };
}