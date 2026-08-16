"use client";

import { cn } from "@/lib/utils";
import { eventColorStyles } from "./calendar-event-color";
import { EventVisual } from "./event-visual";
import type { CalendarEvent } from "@/types/calendar";

interface AllDayDragCopyProps {
  event: CalendarEvent;
  className?: string;
}

/** Cópia flutuante que acompanha o cursor durante o move. */
export function AllDayDragCopy({ event, className }: AllDayDragCopyProps) {
  const styles = eventColorStyles[event.color ?? "green"];

  return (
    <div
      className={cn(
        "h-6 px-2 py-0.5 pointer-events-none cursor-grabbing",
        "overflow-hidden select-none flex items-center gap-1",
        "rounded-sm opacity-80 shadow-lg",
        className,
      )}
    >
      <EventVisual
        event={event}
        rounding="rounded-sm"
        barRounding="rounded-l-md"
      >
        <span
          className={cn(
            "relative font-medium text-[0.625rem] leading-tight whitespace-nowrap pl-1",
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