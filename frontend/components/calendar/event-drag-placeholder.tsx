"use client";

import { cn } from "@/lib/utils";
import { eventColorStyles } from "./calendar-event-color";
import type { CSSProperties } from "react";
import type { CalendarEvent } from "@/types/calendar";

interface EventDragPlaceholderProps {
  event: CalendarEvent;
  /** Position/size computed from the drag state (override start/end). */
  posStyle: CSSProperties;
  className?: string;
}

/** Borda vazia que marca a posição alvo durante o drag/resize. */
export function EventDragPlaceholder({
  event,
  posStyle,
  className,
}: EventDragPlaceholderProps) {
  const styles = eventColorStyles[event.color ?? "green"];

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