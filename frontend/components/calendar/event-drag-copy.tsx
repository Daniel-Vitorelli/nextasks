"use client";

import { cn } from "@/lib/utils";
import { formatEventTimeRange } from "./calendar-event-time";
import { EventVisual } from "./event-visual";
import type { CSSProperties } from "react";
import type { CalendarEvent, PositionedEvent } from "@/types/calendar";

interface EventDragCopyProps {
  event: CalendarEvent;
  /** Evento com o horário já sobrescrito pelo estado do drag. */
  displayEvent: CalendarEvent;
  positionedEvent: PositionedEvent;
  posStyle: CSSProperties;
  hourHeight: number;
  /** Posição fixa na tela (cursor) — usada quando o drag é portado. */
  cursorX?: number;
  cursorY?: number;
  fixedWidth?: number;
  fixedHeight?: number;
  className?: string;
}

/** Cópia flutuante que acompanha o cursor durante o drag. */
export function EventDragCopy({
  event,
  displayEvent,
  positionedEvent,
  posStyle,
  hourHeight,
  cursorX,
  cursorY,
  fixedWidth,
  fixedHeight,
  className,
}: EventDragCopyProps) {
  const durationMinutes =
    (displayEvent.end.getTime() - displayEvent.start.getTime()) / 60000;
  const heightPx = fixedHeight ?? (durationMinutes / 60) * hourHeight;

  const useFixed = cursorX != null && cursorY != null;

  const draggingStyle: CSSProperties = useFixed
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
        "absolute rounded-sm px-2 py-1 max-sm:px-1",
        "pointer-events-none cursor-grabbing",
        "overflow-hidden select-none opacity-80 shadow-lg",
        className,
      )}
      style={draggingStyle}
    >
      <EventVisual
        event={event}
        rounding="rounded-sm"
        barRounding="rounded-l-md"
      >
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
      </EventVisual>
    </div>
  );
}