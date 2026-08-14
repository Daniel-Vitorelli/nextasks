"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import type { CalendarEvent } from "@/types/calendar";
import { eventColorStyles } from "./calendar-event-color";

interface EventVisualProps {
  event: CalendarEvent;
  /**
   * Border radius applied to the solid and colored background layers
   * (e.g. "rounded-t-md"). Pass "rounded-sm" for floating drag copies.
   */
  rounding?: string;
  /**
   * Border radius applied to the left color bar. Defaults to `rounding`
   * when omitted.
   */
  barRounding?: string;
  /** When true the 4px left color bar is rendered (segment start / spanStart) */
  showLeftBar?: boolean;
  /** When true the solid border color replaces the tinted background */
  isSelected?: boolean;
  /** When true the event is in the past and gets dimmed */
  isPast?: boolean;
  children?: React.ReactNode;
}

/**
 * Shared visual layers for an event chip: a solid background (to prevent
 * transparency bleed-through), the colored background, and the left color
 * bar. Used by both timed and all-day event items across every drag variant.
 */
export function EventVisual({
  event,
  rounding,
  barRounding = rounding,
  showLeftBar = true,
  isSelected,
  isPast,
  children,
}: EventVisualProps) {
  const styles = eventColorStyles[event.color ?? "green"];

  return (
    <>
      {/* Solid background layer to prevent transparency bleed-through */}
      <div
        className={cn(
          "absolute inset-0 bg-white dark:bg-[#191919]",
          rounding,
        )}
      />

      {/* Colored background layer - uses border color when selected */}
      <div
        className={cn(
          "absolute inset-0",
          rounding,
          isSelected ? styles.border : styles.bg,
          isPast && !isSelected && "opacity-60",
        )}
      />

      {/* Left border - hidden when selected (merges with bg) */}
      {showLeftBar && !isSelected && (
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 w-[4px] dark:bg-white dark:mix-blend-overlay",
            barRounding,
            styles.border,
            isPast && "opacity-60",
          )}
        />
      )}

      {children}
    </>
  );
}
