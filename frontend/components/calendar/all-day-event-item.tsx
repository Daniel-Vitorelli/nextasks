"use client";

import * as React from "react";
import { createPortal } from "react-dom";
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
import { EventContextMenu } from "./event-context-menu";
import { eventColorStyles } from "./calendar-event-color";
import { formatTimeDisplay } from "./calendar-event-time";
import { EventVisual } from "./event-visual";
import { AllDayDragCopy } from "./all-day-drag-copy";
import { AllDayDragGhost } from "./all-day-drag-ghost";
import { AllDayDragPlaceholder } from "./all-day-drag-placeholder";

/** Drag visual variant for all-day events */
export type AllDayDragVariant = "ghost" | "placeholder" | "dragging";

export interface AllDayEventItemProps {
  event: CalendarEvent;
  isPast?: boolean;
  isSelected?: boolean;
  onClick?: (event: CalendarEvent) => void;
  className?: string;
  /** For multi-day events: position info */
  spanStart?: boolean;
  spanEnd?: boolean;
  /** Pointer handler to initiate horizontal resize or drag (mouse or touch) */
  onResizeMouseDown?: (
    e: React.PointerEvent,
    event: CalendarEvent,
    edge: "left" | "right" | "move",
  ) => void;
  /** Callback when an event is changed (e.g. color change from context menu) */
  onEventChange?: (event: CalendarEvent) => void;
  /** Callback when an event should be deleted */
  onEventDelete?: (event: CalendarEvent) => void;
  /** Callback when an event should be duplicated */
  onEventDuplicate?: (event: CalendarEvent) => void;
  /** Callback when context menu open state changes */
  onContextMenuOpenChange?: (open: boolean) => void;
  /** Whether the right sidebar is open (controls popover visibility) */
  isSidebarOpen?: boolean;
  /** Callback to dock popover to sidebar */
  onDockToSidebar?: () => void;
  /** Callback to close popover (deselect event) */
  onClosePopover?: () => void;
  /** Navigate to previous week */
  onPrevWeek?: () => void;
  /** Navigate to next week */
  onNextWeek?: () => void;
  /**
   * Percentage of the event's width that is hidden off-screen to the left.
   * Used in day view to offset the title into the visible area so multi-day
   * events always show their title — "sticky title" effect.
   */
  titleOffsetPercent?: number;
  /** Visual variant during drag operations */
  dragVariant?: AllDayDragVariant;
}

const ALL_DAY_RESIZE_HOTZONE_PX = 6;
/** Finger-friendlier resize target on touch screens. */
const ALL_DAY_TOUCH_HOTZONE_PX = 18;
/** Pixels of finger movement that turn a tap into a drag. */
const TOUCH_SLOP_PX = 10;

export function AllDayEventItem({
  event,
  isPast: isPastProp,
  isSelected,
  onClick,
  className,
  spanStart = true,
  spanEnd = true,
  onResizeMouseDown,
  onEventChange,
  onEventDelete,
  onEventDuplicate,
  onContextMenuOpenChange,
  isSidebarOpen,
  onClosePopover,
  titleOffsetPercent = 0,
  dragVariant,
}: AllDayEventItemProps) {
  const color = event.color ?? "green";
  const styles = eventColorStyles[color];
  const { view, boundaryRight, headerBottom } = useCalendarPopoverBoundary();
  const isDayView = view === "day";
  const eventIsPast = isPastProp ?? isPast(event.end);

  const [contextMenu, setContextMenu] = React.useState<{
    x: number;
    y: number;
  } | null>(null);

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

  const spanRounding = cn(
    spanStart && "rounded-l-md",
    spanEnd && "rounded-r-md",
  );

  // Ghost: faded version at original position during move
  if (dragVariant === "ghost") {
    return (
      <AllDayDragGhost
        event={event}
        spanStart={spanStart}
        spanEnd={spanEnd}
        className={className}
      />
    );
  }

  // Placeholder: border-only outline at target position
  if (dragVariant === "placeholder") {
    return (
      <AllDayDragPlaceholder event={event} className={className} />
    );
  }

  // Dragging copy: floating replica following cursor
  if (dragVariant === "dragging") {
    return <AllDayDragCopy event={event} className={className} />;
  }

  // Check if event has a specific start time (not midnight)
  const hasStartTime =
    event.start.getHours() !== 0 || event.start.getMinutes() !== 0;

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    if (!onClick) {
      return;
    }
    onClick(event);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "Enter" && e.key !== " ") {
      return;
    }
    e.preventDefault();
    onClick?.(event);
  }

  function handleAllDayPointerMove(e: React.PointerEvent) {
    if (e.pointerType !== "mouse") {
      // Finger movement beyond the slop marks the gesture as a real drag, so
      // the synthesized click that follows is dropped instead of opening the
      // detail popover. A plain tap stays a tap and opens the popover.
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
    const offsetX = e.clientX - rect.left;
    const width = rect.width;

    if (spanStart && offsetX <= ALL_DAY_RESIZE_HOTZONE_PX) {
      target.style.cursor = "col-resize";
      return;
    }

    if (spanEnd && offsetX >= width - ALL_DAY_RESIZE_HOTZONE_PX) {
      target.style.cursor = "col-resize";
      return;
    }

    target.style.removeProperty("cursor");
  }

  function handleAllDayPointerLeave(e: React.PointerEvent) {
    dragStartPointRef.current = null;
    (e.currentTarget as HTMLElement).style.removeProperty("cursor");
  }

  function handleAllDayPointerDown(e: React.PointerEvent) {
    if (!onResizeMouseDown) return;

    didDragRef.current = false;
    dragStartPointRef.current = { x: e.clientX, y: e.clientY };

    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const width = rect.width;
    const hotzone =
      e.pointerType === "mouse"
        ? ALL_DAY_RESIZE_HOTZONE_PX
        : ALL_DAY_TOUCH_HOTZONE_PX;

    if (spanStart && offsetX <= hotzone) {
      e.stopPropagation();
      onResizeMouseDown(e, event, "left");
      return;
    }

    if (spanEnd && offsetX >= width - hotzone) {
      e.stopPropagation();
      onResizeMouseDown(e, event, "right");
      return;
    }

    // Middle area: initiate drag (move)
    e.stopPropagation();
    onResizeMouseDown(e, event, "move");
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
    onContextMenuOpenChange?.(true);
  }

  const showPopover = isSelected && isSidebarOpen === false;

  const eventElement = (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onContextMenu={handleContextMenu}
      onPointerMove={handleAllDayPointerMove}
      onPointerLeave={handleAllDayPointerLeave}
      onPointerDown={handleAllDayPointerDown}
      className={cn(
        "relative h-6 px-2 py-0.5 cursor-grab",
        "hover:z-10 focus:outline-none focus-visible:outline-none",
        "overflow-hidden select-none touch-none flex items-center gap-1",
        spanRounding,
        isSelected && "z-20",
        className,
      )}
      style={
        titleOffsetPercent > 0
          ? { paddingLeft: `${titleOffsetPercent}%` }
          : undefined
      }
    >
      <EventVisual
        event={event}
        rounding={spanRounding}
        barRounding={spanStart ? "rounded-l-md" : undefined}
        showLeftBar={spanStart}
        isSelected={isSelected}
        isPast={eventIsPast}
      >
        <span
          className={cn(
            "relative font-medium text-[0.625rem] leading-tight whitespace-nowrap",
            spanStart && "pl-1",
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
        {hasStartTime && (
          <span
            className={cn(
              "relative text-[0.625rem] leading-tight whitespace-nowrap shrink-0",
              isSelected
                ? "text-white dark:text-white"
                : cn(
                    styles.text,
                    "dark:text-white dark:mix-blend-overlay",
                    eventIsPast && "opacity-60",
                  ),
            )}
          >
            {formatTimeDisplay(event.start)}
          </span>
        )}
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
           * In day view, all-day events span the full width. Portal the
           * anchor to document.body (escaping transformed scroll containers)
           * and position it at the calendar boundary's right edge so the
           * popover always appears at the visible right edge — even when the
           * event wrapper extends into off-screen buffer days.
           */}
          {isDayView &&
            createPortal(
              <PopoverAnchor
                className="pointer-events-none"
                style={{
                  position: "fixed",
                  left: boundaryRight,
                  top: 0,
                  bottom: 0,
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
            align="start"
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
