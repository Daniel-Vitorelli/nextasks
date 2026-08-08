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
import type {
  CalendarEvent,
  CalendarEventItemProps,
} from "./week-view-types";
import { EventContextMenu } from "./event-context-menu";
import { eventColorStyles } from "./calendar-event-color";
import { formatEventTimeRange } from "./calendar-event-time";


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
  const { event, segmentPosition = "full" } = positionedEvent;
  const color = event.color ?? "blue";
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

  if (dragVariant === "ghost") {
    return (
      <div
        className={cn(
          "absolute rounded-sm px-2 py-1 pointer-events-none opacity-30 overflow-hidden",
          className,
        )}
        style={{
          top: `${positionedEvent.top}%`,
          height: `${positionedEvent.height}%`,
          left: `${positionedEvent.left}%`,
          width: `${positionedEvent.width}%`,
          minHeight: "20px",
          zIndex: 15,
        }}
      >
        <div className="absolute inset-0 rounded-sm bg-white dark:bg-[#191919]" />
        <div className={cn("absolute inset-0 rounded-sm", styles.bg)} />
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 w-[4px] rounded-l-md dark:bg-white dark:mix-blend-overlay",
            styles.border,
          )}
        />
        <div
          className={cn(
            "relative flex flex-col h-full pl-1 overflow-hidden",
            isCompact && "flex-row items-center gap-1",
          )}
        >
          <span
            className={cn(
              "font-medium text-[0.625rem] leading-tight break-words",
              styles.text,
              "dark:text-white/80",
            )}
          >
            {event.title}
          </span>
          {!isCompact && (
            <span
              className={cn(
                "text-[0.625rem] whitespace-nowrap",
                styles.text,
                "dark:text-white dark:mix-blend-overlay",
              )}
            >
              {formatEventTimeRange(event)}
            </span>
          )}
        </div>
      </div>
    );
  }

  if (dragVariant === "placeholder") {
    return (
      <div
        className={cn(
          "absolute rounded-sm pointer-events-none border-2",
          styles.borderLine,
          className,
        )}
        style={{
          ...posStyle,
          left: "0%",
          width: "100%",
          zIndex: 25,
        }}
      />
    );
  }

  const isDraggingCopy = dragVariant === "dragging";

  if (isDraggingCopy) {
    const durationMinutes =
      (displayEnd.getTime() - displayStart.getTime()) / 60000;
    const heightPx = fixedHeight ?? (durationMinutes / 60) * hourHeight;

    const useFixed = cursorX != null && cursorY != null;

    const draggingStyle: React.CSSProperties = useFixed
      ? {
          position: "fixed",
          top: `${cursorY}px`,
          left: `${cursorX}px`,
          height: `${heightPx}px`,
          width: fixedWidth != null ? `${fixedWidth}px` : "200px",
          minHeight: "20px",
          zIndex: 30,
        }
      : {
          top: posStyle.top,
          height: `${heightPx}px`,
          left: `${positionedEvent.left}%`,
          width: `${positionedEvent.width}%`,
          minHeight: "20px",
          zIndex: 30,
        };

    return (
      <div
        tabIndex={-1}
        className={cn(
          "absolute rounded-sm px-2 py-1",
          "pointer-events-none cursor-grabbing",
          "overflow-hidden select-none opacity-80 shadow-lg",
          className,
        )}
        style={draggingStyle}
      >
        <div className="absolute inset-0 rounded-sm bg-white dark:bg-[#191919]" />
        <div className={cn("absolute inset-0 rounded-sm", styles.bg)} />
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 w-[4px] rounded-l-md dark:bg-white dark:mix-blend-overlay",
            styles.border,
          )}
        />
        <div
          className={cn(
            "relative flex flex-col h-full pl-1 overflow-hidden",
            heightPx < 40 && "flex-row items-center gap-1",
          )}
        >
          <span className="font-medium text-[0.625rem] leading-tight break-words text-white dark:text-white flex items-center gap-0.5">
            {event.title}
          </span>
          {heightPx >= 40 && (
            <span className="text-[0.625rem] whitespace-nowrap text-white dark:text-white">
              {formatEventTimeRange(displayEvent)}
            </span>
          )}
        </div>
      </div>
    );
  }

  function handleMouseMove(e: React.MouseEvent) {
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const height = rect.height;

    if (showTopResize && showBottomResize && height < RESIZE_HOTZONE_PX * 2) {
      target.style.setProperty("--cursor", "row-resize");
      return;
    }

    if (showTopResize && offsetY <= RESIZE_HOTZONE_PX) {
      target.style.setProperty("--cursor", "row-resize");
      return;
    }

    if (showBottomResize && offsetY >= height - RESIZE_HOTZONE_PX) {
      target.style.setProperty("--cursor", "row-resize");
      return;
    }

    target.style.removeProperty("--cursor");
  }

  function handleMouseDown(e: React.MouseEvent) {
    e.stopPropagation();

    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const height = rect.height;

    if (showTopResize && showBottomResize && height < RESIZE_HOTZONE_PX * 2) {
      const edge = offsetY < height / 2 ? "top" : "bottom";
      onResizeMouseDown?.(e, event, edge);
      return;
    }

    if (showTopResize && offsetY <= RESIZE_HOTZONE_PX) {
      onResizeMouseDown?.(e, event, "top");
      return;
    }

    if (showBottomResize && offsetY >= height - RESIZE_HOTZONE_PX) {
      onResizeMouseDown?.(e, event, "bottom");
      return;
    }

    onDragMouseDown?.(e, event);
  }

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
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
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onContextMenu={handleContextMenu}
      className={cn(
        "absolute px-2 py-1",
        hasTopRounding && "rounded-t-md",
        hasBottomRounding && "rounded-b-md",
        "cursor-default hover:z-10 focus:outline-none focus-visible:outline-none",
        "overflow-hidden select-none",
        isSelected && "z-20",
        className,
      )}
      style={{
        ...posStyle,
        zIndex: isSelected ? 20 : positionedEvent.column,
      }}
    >
      {/* Solid background layer to prevent transparency bleed-through */}
      <div
        className={cn(
          "absolute inset-0 bg-white dark:bg-[#191919]",
          hasTopRounding && "rounded-t-md",
          hasBottomRounding && "rounded-b-md",
        )}
      />

      {/* Colored background layer - uses border color when selected */}
      <div
        className={cn(
          "absolute inset-0",
          hasTopRounding && "rounded-t-md",
          hasBottomRounding && "rounded-b-md",
          isSelected ? styles.border : styles.bg,
          eventIsPast && !isSelected && "opacity-60",
        )}
      />

      {/* Left border - hidden when selected (merges with bg) */}
      {!isSelected && (
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 w-[4px] dark:bg-white dark:mix-blend-overlay",
            hasTopRounding && "rounded-tl-md",
            hasBottomRounding && "rounded-bl-md",
            styles.border,
            eventIsPast && "opacity-60",
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
            {formatEventTimeRange(displayEvent)}
          </span>
        )}
      </div>
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
           * the popover extends leftward \u2014 matching Notion Calendar.
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
