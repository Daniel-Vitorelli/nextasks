"use client";

import { cn } from "@/lib/utils";
import { eventColorStyles } from "./calendar-event-color";
import type { CalendarEvent } from "@/types/calendar";

interface AllDayDragPlaceholderProps {
  event: CalendarEvent;
  className?: string;
}

/** Borda vazia que marca a posição alvo durante o move/resize. */
export function AllDayDragPlaceholder({
  event,
  className,
}: AllDayDragPlaceholderProps) {
  const styles = eventColorStyles[event.color ?? "green"];

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