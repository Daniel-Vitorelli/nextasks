"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { PopoverContent } from "@/components/ui/popover";
import { EventDetailPanel } from "./event-detail-panel";
import { useCalendarPopoverBoundary } from "./calendar-popover-context";
import type { CalendarEvent } from "./week-view-types";

interface EventDetailPopoverProps {
  event: CalendarEvent;
  onEventChange?: (event: CalendarEvent) => void;
  onEventDelete?: (event: CalendarEvent) => void;
  onEventDuplicate?: (event: CalendarEvent) => void;
  onClose: () => void;
  /** Which side to prefer for the popover. Defaults to "right". */
  side?: "right" | "bottom" | "left" | "top";
  /** Alignment along the side axis. Defaults to "center". */
  align?: "start" | "center" | "end";
  /**
   * Override the top collision padding. When omitted the header height is
   * used so the popover never overlaps the weekday header. All-day events
   * live *inside* the header, so they pass a small value to avoid being
   * pushed off-screen.
   */
  collisionPaddingTop?: number;
}

/** True at or below the `sm` Tailwind breakpoint (mobile). */
function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const mql = window.matchMedia("(max-width: 640px)");
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  return isMobile;
}

export function EventDetailPopover({
  event,
  onEventChange,
  onEventDelete,
  onEventDuplicate,
  onClose,
  side = "right",
  align = "center",
  collisionPaddingTop,
}: EventDetailPopoverProps) {
  const { boundary, headerHeight, view } = useCalendarPopoverBoundary();
  const t = useTranslations("dashboard.routines.calendar");
  const isMobile = useIsMobile();

  /**
   * In day view the event trigger spans the full grid width, leaving no room
   * for a 320px popover on either side within the calendar container.
   * Skip the collision boundary so Radix uses the viewport instead.
   */
  const isDayView = view === "day";
  const effectiveBoundary = isDayView
    ? undefined
    : boundary
      ? [boundary]
      : undefined;

  const popoverHeaderActions = (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="size-7 text-[#C7C5C1] dark:text-[#595959]"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        title={t("close")}
      >
        <X className="size-4" />
      </Button>
    </>
  );

  const panel = (
    <EventDetailPanel
      event={event}
      onEventChange={onEventChange}
      onEventDelete={onEventDelete}
      onEventDuplicate={onEventDuplicate}
      headerActions={popoverHeaderActions}
    />
  );

  // On phones a side-anchored popover always clips part of its content
  // (narrow columns, events near the screen edges). Render the panel as a
  // bottom sheet that spans the screen, so it's always fully visible.
  if (isMobile) {
    return (
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          showCloseButton={false}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          className="shadow-2xl bg-background top-auto bottom-0 left-0 right-0 w-full max-w-none translate-y-0 translate-x-0 rounded-t-2xl rounded-b-none rounded-none border-x-0 border-b-0 p-0 pb-[env(safe-area-inset-bottom)] max-h-[85dvh] overflow-y-auto overscroll-contain sm:max-w-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-bottom-full data-[state=open]:slide-in-from-bottom-full"
        >
          <DialogTitle className="sr-only">{t("blockDetails")}</DialogTitle>
          {panel}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <PopoverContent
      side={side}
      align={align}
      sideOffset={8}
      collisionPadding={{
        top: collisionPaddingTop ?? headerHeight,
        bottom: 8,
        left: 16,
        right: 16,
      }}
      collisionBoundary={effectiveBoundary}
      className="w-[320px] max-w-[calc(100vw-1rem)] max-h-[80vh] overflow-y-auto p-0 bg-popover/60 backdrop-blur-xl border shadow-lg rounded-lg"
      onOpenAutoFocus={(e) => e.preventDefault()}
      onCloseAutoFocus={(e) => e.preventDefault()}
      onInteractOutside={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest("[data-radix-popper-content-wrapper]")) {
          e.preventDefault();
        }
      }}
    >
      {panel}
    </PopoverContent>
  );
}