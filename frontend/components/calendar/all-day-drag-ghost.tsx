"use client";

import { cn } from "@/lib/utils";
import { eventColorStyles } from "./calendar-event-color";
import { EventVisual } from "./event-visual";
import type { CalendarEvent } from "@/types/calendar";

interface AllDayDragGhostProps {
  event: CalendarEvent;
  /** True when the event starts within the visible span (shows left bar). */
  spanStart?: boolean;
  /** True when the event ends within the visible span. */
  spanEnd?: boolean;
  className?: string;
}

/** Cópia semi-transparente que permanece no lugar do evento durante o move. */
export function AllDayDragGhost({
  event,
  spanStart = true,
  spanEnd = true,
  className,
}: AllDayDragGhostProps) {
  const styles = eventColorStyles[event.color ?? "green"];
  const spanRounding = cn(spanStart && "rounded-l-md", spanEnd && "rounded-r-md");

  return (
    <div
      className={cn(
        "relative h-6 px-2 py-0.5 pointer-events-none opacity-30",
        "overflow-hidden select-none flex items-center gap-1",
        spanRounding,
        className,
      )}
    >
      <EventVisual
        event={event}
        rounding={spanRounding}
        barRounding={spanStart ? "rounded-l-md" : undefined}
        showLeftBar={spanStart}
      >
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
      </EventVisual>
    </div>
  );
}