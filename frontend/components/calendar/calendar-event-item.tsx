"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useLocale } from "next-intl";
import { cn } from "@/lib/utils";
import { isPast } from "date-fns";
import {
  Popover,
  PopoverAnchor,
  PopoverTrigger,
} from "@/components/ui/popover";
import { EventDetailPopover } from "./event-detail-popover";
import { useCalendarPopoverBoundary } from "./calendar-popover-context";
import type { CalendarEvent } from "@/types/calendar";
import type { CalendarEventItemProps } from "./week-view-types";
import { EventContextMenu } from "./event-context-menu";
import { eventColorStyles } from "./calendar-event-color";
import { formatEventTimeRange } from "./calendar-event-time";
import { EventVisual } from "./event-visual";
import { EventDragCopy } from "./event-drag-copy";
import { EventDragGhost } from "./event-drag-ghost";
import { EventDragPlaceholder } from "./event-drag-placeholder";

function computeOverrideStyle(
  positionedEvent: CalendarEventItemProps["positionedEvent"],
  hourHeight: number,
  overrideStart: Date,
  overrideEnd: Date,
) {
  const startMinutes =
    overrideStart.getHours() * 60 + overrideStart.getMinutes();
  let endMinutes = overrideEnd.getHours() * 60 + overrideEnd.getMinutes();
  // If end is midnight and on a different day than start, treat as 1440 (end of day)
  if (endMinutes === 0 && overrideEnd.getDate() !== overrideStart.getDate()) {
    endMinutes = 1440;
  }
  const topPx = (startMinutes / 60) * hourHeight;
  const heightPx = ((endMinutes - startMinutes) / 60) * hourHeight;

  return {
    top: `${topPx}px`,
    height: `${heightPx}px`,
    left: `${positionedEvent.left}%`,
    width: `${positionedEvent.width}%`,
    minHeight: "20px",
  };
}

const RESIZE_HOTZONE_PX = 8;
/** Finger-friendlier resize target on touch screens. */
const TOUCH_RESIZE_HOTZONE_PX = 18;
/**
 * Pixels of finger movement that turn a tap into a drag. Kept in sync with
 * the touch slop in the drag/resize hooks so the drag ghost appears exactly
 * when the synthesized click starts being suppressed.
 */
const TOUCH_SLOP_PX = 10;

function resolveResizeEdge(
  offsetY: number,
  height: number,
  showTop: boolean,
  showBottom: boolean,
  hotzone: number,
): "top" | "bottom" | null {
  if (showTop && showBottom && height < hotzone * 2) {
    return offsetY < height / 2 ? "top" : "bottom";
  }
  if (showTop && offsetY <= hotzone) {
    return "top";
  }
  if (showBottom && offsetY >= height - hotzone) {
    return "bottom";
  }
  return null;
}

export function CalendarEventItem({
  positionedEvent,
  hourHeight,
  isPast: isPastProp,
  isSelected,
  onClick,
  dragVariant = "default",
  overrideStart,
  overrideEnd,
  onDragMouseDown,
  onResizeMouseDown,
  onEventChange,
  onEventDelete,
  onEventDuplicate,
  cursorY,
  cursorX,
  fixedWidth,
  fixedHeight,
  onContextMenuOpenChange,
  isSidebarOpen,
  onClosePopover,
  className,
}: CalendarEventItemProps) {
  const locale = useLocale();
  const { event, segmentPosition = "full" } = positionedEvent;
  const color = event.color ?? "green";
  const styles = eventColorStyles[color];
  const eventIsPast = isPastProp ?? isPast(event.end);
  const { view, boundaryRight, headerBottom } = useCalendarPopoverBoundary();
  const isDayView = view === "day";

  /** Ref to the event button element, used to measure its viewport rect. */
  const eventRef = React.useRef<HTMLDivElement>(null);

  /**
   * Viewport-relative top & height of the event element.
   * Used to vertically align the day-view PopoverAnchor with the event
   * so the popover appears beside the event rather than at a fixed position.
   */
  const [anchorRect, setAnchorRect] = React.useState<{
    top: number;
    height: number;
  } | null>(null);

  const showPopover = isSelected && isSidebarOpen === false;

  // Measure the event element's viewport position when the popover opens in
  // day view. useLayoutEffect ensures the measurement happens before paint so
  // the PopoverAnchor is positioned correctly on first frame.
  React.useLayoutEffect(() => {
    if (!showPopover || !isDayView || !eventRef.current) {
      setAnchorRect(null);
      return;
    }
    const rect = eventRef.current.getBoundingClientRect();
    setAnchorRect({ top: rect.top, height: rect.height });
  }, [showPopover, isDayView]);

  const hasTopRounding =
    segmentPosition === "start" || segmentPosition === "full";
  const hasBottomRounding =
    segmentPosition === "end" || segmentPosition === "full";
  const showTopResize =
    segmentPosition === "start" || segmentPosition === "full";
  const showBottomResize =
    segmentPosition === "end" || segmentPosition === "full";

  const [contextMenu, setContextMenu] = React.useState<{
    x: number;
    y: number;
  } | null>(null);

  /** Which resize edge the pointer is currently over (drives hint + cursor) */
  const [resizeHover, setResizeHover] = React.useState<
    "top" | "bottom" | null
  >(null);

  /**
   * True while a touch drag/resize started, so the synthesized click that
   * follows the gesture is dropped instead of opening the detail popover.
   */
  const didDragRef = React.useRef(false);
  /** Where the pointer pressed down, used to tell a tap from a drag. */
  const dragStartPointRef = React.useRef<{ x: number; y: number } | null>(null);

  const closeContextMenu = React.useCallback(() => {
    setContextMenu(null);
    onContextMenuOpenChange?.(false);
  }, [onContextMenuOpenChange]);

  const displayStart = overrideStart ?? event.start;
  const displayEnd = overrideEnd ?? event.end;

  const displayEvent: CalendarEvent =
    overrideStart && overrideEnd
      ? { ...event, start: displayStart, end: displayEnd }
      : event;

  const defaultStyle = {
    top: `${positionedEvent.top}%`,
    height: `${positionedEvent.height}%`,
    left: `${positionedEvent.left}%`,
    width: `${positionedEvent.width}%`,
    minHeight: "20px",
    zIndex: isSelected ? 20 : positionedEvent.column,
  };

  const posStyle =
    overrideStart && overrideEnd
      ? computeOverrideStyle(
          positionedEvent,
          hourHeight,
          overrideStart,
          overrideEnd,
        )
      : defaultStyle;

  const heightInPixels =
    overrideStart && overrideEnd
      ? Number.parseFloat(String(posStyle.height))
      : (positionedEvent.height / 100) * 24 * hourHeight;
  const isCompact = heightInPixels < 40;

  const chipRounding = cn(
    hasTopRounding && "rounded-t-md",
    hasBottomRounding && "rounded-b-md",
  );
  const chipBarRounding = cn(
    hasTopRounding && "rounded-tl-md",
    hasBottomRounding && "rounded-bl-md",
  );

  if (dragVariant === "ghost") {
    return (
      <EventDragGhost
        event={event}
        positionedEvent={positionedEvent}
        isCompact={isCompact}
        className={className}
      />
    );
  }

  if (dragVariant === "placeholder") {
    return (
      <EventDragPlaceholder
        event={event}
        posStyle={posStyle}
        className={className}
      />
    );
  }

  const isDraggingCopy = dragVariant === "dragging";

  if (isDraggingCopy) {
    return (
      <EventDragCopy
        event={event}
        displayEvent={displayEvent}
        positionedEvent={positionedEvent}
        posStyle={posStyle}
        hourHeight={hourHeight}
        cursorX={cursorX}
        cursorY={cursorY}
        fixedWidth={fixedWidth}
        fixedHeight={fixedHeight}
        className={className}
      />
    );
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (e.pointerType !== "mouse") {
      // Finger movement beyond the slop marks the gesture as a real drag, so
      // the synthesized click that follows is dropped instead of opening the
      // detail popover.
      const point = dragStartPointRef.current;
      if (!didDragRef.current && point) {
        const dx = e.clientX - point.x;
        const dy = e.clientY - point.y;
        if (Math.hypot(dx, dy) >= TOUCH_SLOP_PX) {
          didDragRef.current = true;
        }
      }
      return;
    }

    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const height = rect.height;

    const edge = resolveResizeEdge(
      offsetY,
      height,
      showTopResize,
      showBottomResize,
      RESIZE_HOTZONE_PX,
    );
    target.style.cursor = edge ? "row-resize" : "grab";
    setResizeHover((current) => (current === edge ? current : edge));
  }

  function handlePointerLeave(e: React.PointerEvent) {
    dragStartPointRef.current = null;
    (e.currentTarget as HTMLElement).style.removeProperty("cursor");
  }

  function handlePointerDown(e: React.PointerEvent) {
    e.stopPropagation();
    didDragRef.current = false;
    dragStartPointRef.current = { x: e.clientX, y: e.clientY };

    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const height = rect.height;

    // Mouse: keep the desktop behavior — immediate resize or drag.
    if (e.pointerType === "mouse") {
      const edge = resolveResizeEdge(
        offsetY,
        height,
        showTopResize,
        showBottomResize,
        RESIZE_HOTZONE_PX,
      );
      if (edge) {
        onResizeMouseDown?.(e, event, edge);
        return;
      }
      onDragMouseDown?.(e, event);
      return;
    }

    // Touch/pen: grabbing an edge resizes immediately...
    const edge = resolveResizeEdge(
      offsetY,
      height,
      showTopResize,
      showBottomResize,
      TOUCH_RESIZE_HOTZONE_PX,
    );
    if (edge) {
      didDragRef.current = true;
      onResizeMouseDown?.(e, event, edge);
      return;
    }

    // ...otherwise pick the event up right away. The element uses
    // touch-action: none, so the browser never hijacks the gesture for
    // scrolling; a finger can move the event immediately, no long-press.
    onDragMouseDown?.(e, event, target);
  }

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    if (!onClick) return;
    onClick(event);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    onClick?.(event);
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
    onContextMenuOpenChange?.(true);
  }

  const eventElement = (
    <div
      ref={eventRef}
      role="button"
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onContextMenu={handleContextMenu}
      className={cn(
        "group absolute px-2 py-1 max-sm:px-1",
        chipRounding,
        "cursor-grab hover:z-10 focus:outline-none focus-visible:outline-none",
        "overflow-hidden select-none touch-none",
        isSelected && "z-20",
        className,
      )}
      style={{
        ...posStyle,
        zIndex: isSelected ? 20 : positionedEvent.column,
      }}
    >
      <EventVisual
        event={event}
        rounding={chipRounding}
        barRounding={chipBarRounding}
        showLeftBar
        isSelected={isSelected}
        isPast={eventIsPast}
      >
        {/* Resize hint edges — highlighted when the pointer is over the
            corresponding hotzone, so resizing feels discoverable */}
        {showTopResize && (
          <div
            className={cn(
              "absolute left-0 right-0 top-0 h-[3px] pointer-events-none transition-opacity duration-100",
              hasTopRounding && "rounded-t-md",
              styles.border,
              "dark:bg-white dark:mix-blend-overlay",
              resizeHover === "top"
                ? "opacity-100"
                : "opacity-0 group-hover:opacity-60",
            )}
          />
        )}
        {showBottomResize && (
          <div
            className={cn(
              "absolute left-0 right-0 bottom-0 h-[3px] pointer-events-none transition-opacity duration-100",
              hasBottomRounding && "rounded-b-md",
              styles.border,
              "dark:bg-white dark:mix-blend-overlay",
              resizeHover === "bottom"
                ? "opacity-100"
                : "opacity-0 group-hover:opacity-60",
            )}
          />
        )}
        <div
          className={cn(
            "relative flex flex-col h-full pl-1 overflow-hidden",
            isCompact && "flex-row items-center gap-1",
          )}
        >
          <span
            className={cn(
              "font-medium text-[0.625rem] leading-tight break-words flex items-center gap-0.5",
              isSelected
                ? "text-white dark:text-white"
                : cn(
                    styles.text,
                    "dark:text-white/80",
                    eventIsPast && "opacity-60",
                  ),
            )}
          >
            {event.title}
          </span>
          {!isCompact && (
            <span
              className={cn(
                "text-[0.625rem] whitespace-nowrap",
                isSelected
                  ? "text-white dark:text-white"
                  : cn(
                      styles.text,
                      "dark:text-white dark:mix-blend-overlay",
                      eventIsPast && "opacity-60 dark:opacity-100",
                    ),
              )}
            >
              {formatEventTimeRange(displayEvent, locale)}
            </span>
          )}
        </div>
      </EventVisual>
    </div>
  );

  if (showPopover) {
    return (
      <>
        <Popover
          open
          onOpenChange={(open) => {
            if (!open) onClosePopover?.();
          }}
        >
          <PopoverTrigger asChild>{eventElement}</PopoverTrigger>
          {/*
           * In day view the event spans the full grid width, so Radix can't
           * fit the popover beside the trigger. Place a zero-width anchor at
           * the RIGHT edge of the calendar boundary and use side="left" so
           * the popover extends leftward — matching Notion Calendar.
           *
           * The anchor is portaled to document.body to escape scroll
           * containers that apply CSS transforms (which break position:fixed
           * by creating a new containing block).
           */}
          {isDayView &&
            createPortal(
              <PopoverAnchor
                className="pointer-events-none"
                style={{
                  position: "fixed",
                  left: boundaryRight,
                  top: anchorRect?.top ?? 0,
                  height: anchorRect?.height ?? 0,
                  width: 0,
                }}
              />,
              document.body,
            )}
          <EventDetailPopover
            event={event}
            onEventChange={onEventChange}
            onEventDelete={onEventDelete}
            onEventDuplicate={onEventDuplicate}
            onClose={() => onClosePopover?.()}
            side={isDayView ? "left" : "right"}
            collisionPaddingTop={isDayView ? headerBottom : undefined}
          />
        </Popover>
        {contextMenu && (
          <EventContextMenu
            event={event}
            position={contextMenu}
            onClose={closeContextMenu}
            onEventChange={onEventChange}
            onEventDelete={onEventDelete}
          />
        )}
      </>
    );
  }

  return (
    <>
      {eventElement}
      {contextMenu && (
        <EventContextMenu
          event={event}
          position={contextMenu}
          onClose={closeContextMenu}
          onEventChange={onEventChange}
          onEventDelete={onEventDelete}
        />
      )}
    </>
  );
}
