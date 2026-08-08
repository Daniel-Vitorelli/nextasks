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
import type { CalendarEvent } from "./week-view-types";
import { EventContextMenu } from "./event-context-menu";
import { eventColorStyles } from "./calendar-event-color";
import { formatTimeDisplay } from "./calendar-event-time";

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
  /** Mousedown handler to initiate horizontal resize or drag */
  onResizeMouseDown?: (
    e: React.MouseEvent,
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
   * events always show their title \u2014 \u201csticky title\u201d effect.
   */
  titleOffsetPercent?: number;
  /** Visual variant during drag operations */
  dragVariant?: AllDayDragVariant;
}

const ALL_DAY_RESIZE_HOTZONE_PX = 6;

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
  const color = event.color ?? "blue";
  const styles = eventColorStyles[color];
  const { view, boundaryRight, headerBottom } = useCalendarPopoverBoundary();
  const isDayView = view === "day";
  const eventIsPast = isPastProp ?? isPast(event.end);

  const [contextMenu, setContextMenu] = React.useState<{
    x: number;
    y: number;
  } | null>(null);

  const closeContextMenu = React.useCallback(() => {
    setContextMenu(null);
    onContextMenuOpenChange?.(false);
  }, [onContextMenuOpenChange]);

  // Ghost: faded version at original position during move
  if (dragVariant === "ghost") {
    return (
      <div
        className={cn(
          "relative h-6 px-2 py-0.5 pointer-events-none opacity-30",
          "overflow-hidden select-none flex items-center gap-1",
          spanStart && "rounded-l-md",
          spanEnd && "rounded-r-md",
          className,
        )}
      >
        <div
          className={cn(
            "absolute inset-0 bg-white dark:bg-[#191919]",
            spanStart && "rounded-l-md",
            spanEnd && "rounded-r-md",
          )}
        />
        <div
          className={cn(
            "absolute inset-0",
            styles.bg,
            spanStart && "rounded-l-md",
            spanEnd && "rounded-r-md",
          )}
        />
        {spanStart && (
          <div
            className={cn(
              "absolute left-0 top-0 bottom-0 w-[4px] dark:bg-white dark:mix-blend-overlay",
              spanStart && "rounded-l-md",
              styles.border,
            )}
          />
        )}
        <span
          className={cn(
            "relative font-medium text-[0.625rem] leading-tight whitespace-nowrap",
            spanStart && "pl-1",
            styles.text,
            "dark:text-white/80",
          )}
        >
          {event.title}
        </span>
      </div>
    );
  }

  // Placeholder: border-only outline at target position
  if (dragVariant === "placeholder") {
    return (
      <div
        className={cn(
          "relative h-6 pointer-events-none border-2 rounded-sm",
          styles.borderLine,
          className,
        )}
      />
    );
  }

  // Dragging copy: floating replica following cursor
  if (dragVariant === "dragging") {
    return (
      <div
        className={cn(
          "h-6 px-2 py-0.5 pointer-events-none cursor-grabbing",
          "overflow-hidden select-none flex items-center gap-1",
          "rounded-sm opacity-80 shadow-lg",
          className,
        )}
      >
        <div className="absolute inset-0 rounded-sm bg-white dark:bg-[#191919]" />
        <div className={cn("absolute inset-0 rounded-sm", styles.bg)} />
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 w-[4px] rounded-l-md dark:bg-white dark:mix-blend-overlay",
            styles.border,
          )}
        />
        <span
          className={cn(
            "relative font-medium text-[0.625rem] leading-tight whitespace-nowrap pl-1",
            styles.text,
            "dark:text-white/80",
          )}
        >
          {event.title}
        </span>
      </div>
    );
  }

  // Check if event has a specific start time (not midnight)
  const hasStartTime =
    event.start.getHours() !== 0 || event.start.getMinutes() !== 0;

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
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

  function handleAllDayMouseMove(e: React.MouseEvent) {
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const width = rect.width;

    if (spanStart && offsetX <= ALL_DAY_RESIZE_HOTZONE_PX) {
      target.style.setProperty("--cursor", "col-resize");
      return;
    }

    if (spanEnd && offsetX >= width - ALL_DAY_RESIZE_HOTZONE_PX) {
      target.style.setProperty("--cursor", "col-resize");
      return;
    }

    target.style.removeProperty("--cursor");
  }

  function handleAllDayMouseDown(e: React.MouseEvent) {
    if (!onResizeMouseDown) return;

    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const width = rect.width;

    if (spanStart && offsetX <= ALL_DAY_RESIZE_HOTZONE_PX) {
      e.stopPropagation();
      onResizeMouseDown(e, event, "left");
      return;
    }

    if (spanEnd && offsetX >= width - ALL_DAY_RESIZE_HOTZONE_PX) {
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
      onMouseMove={handleAllDayMouseMove}
      onMouseDown={handleAllDayMouseDown}
      className={cn(
        "relative h-6 px-2 py-0.5 cursor-default",
        "hover:z-10 focus:outline-none focus-visible:outline-none",
        "overflow-hidden select-none flex items-center gap-1",
        spanStart && "rounded-l-md",
        spanEnd && "rounded-r-md",
        isSelected && "z-20",
        className,
      )}
      style={
        titleOffsetPercent > 0
          ? { paddingLeft: `${titleOffsetPercent}%` }
          : undefined
      }
    >
      {/* Solid background layer to prevent transparency bleed-through */}
      <div
        className={cn(
          "absolute inset-0 bg-white dark:bg-[#191919]",
          spanStart && "rounded-l-md",
          spanEnd && "rounded-r-md",
        )}
      />

      {/* Colored background layer - uses border color when selected */}
      <div
        className={cn(
          "absolute inset-0",
          isSelected ? styles.border : styles.bg,
          spanStart && "rounded-l-md",
          spanEnd && "rounded-r-md",
          eventIsPast && !isSelected && "opacity-60",
        )}
      />

      {/* Left border - hidden when selected (merges with bg) */}
      {spanStart && !isSelected && (
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 w-[4px] dark:bg-white dark:mix-blend-overlay",
            spanStart && "rounded-l-md",
            styles.border,
            eventIsPast && "opacity-60",
          )}
        />
      )}
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
           * popover always appears at the visible right edge \u2014 even when the
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