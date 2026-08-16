"use client";

import { cn } from "@/lib/utils";
import { eventColorStyles } from "./calendar-event-color";
import { formatEventTimeRange } from "./calendar-event-time";
import { EventVisual } from "./event-visual";
import type { CalendarEvent, PositionedEvent } from "@/types/calendar";

interface EventDragGhostProps {
  event: CalendarEvent;
  positionedEvent: PositionedEvent;
  /** True when the event is too short to stack title and time vertically. */
  isCompact: boolean;
  className?: string;
}

/** Cópia semi-transparente que permanece no lugar do evento durante o drag. */
export function EventDragGhost({
  event,
  positionedEvent,
  isCompact,
  className,
}: EventDragGhostProps) {
  const styles = eventColorStyles[event.color ?? "green"];

  return (
    <div
      className={cn(
        "absolute rounded-sm px-2 py-1 max-sm:px-1 pointer-events-none opacity-30 overflow-hidden",
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
      <EventVisual
        event={event}
        rounding="rounded-sm"
        barRounding="rounded-l-md"
      >
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
      </EventVisual>
    </div>
  );
}