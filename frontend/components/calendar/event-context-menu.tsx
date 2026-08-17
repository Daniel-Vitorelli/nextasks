"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Check, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { CalendarEvent, EventColor } from "@/types/calendar";
import { EVENT_COLORS } from "@/lib/calendar/event-constants";
import { colorSwatchClass } from "./calendar-event-color";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface EventContextMenuProps {
  event: CalendarEvent;
  position: { x: number; y: number };
  onClose: () => void;
  onEventChange?: (event: CalendarEvent) => void;
  onEventDelete?: (event: CalendarEvent) => void;
}

export function EventContextMenu({
  event,
  position,
  onClose,
  onEventChange,
  onEventDelete,
}: EventContextMenuProps) {
  const t = useTranslations("dashboard.routines.calendar");
  const currentColor = event.color ?? "green";

  function handleColorSelect(color: EventColor) {
    onEventChange?.({ ...event, color });
    onClose();
  }

  return createPortal(
    <DropdownMenu open onOpenChange={(open) => !open && onClose()}>
      {/* Trigger invisivel ancorado na posicao do clique para o
          floating-ui posicionar o conteudo (menu de contexto). */}
      <DropdownMenuTrigger asChild>
        <span
          aria-hidden
          style={{
            position: "fixed",
            left: position.x,
            top: position.y,
            width: 1,
            height: 1,
            pointerEvents: "none",
          }}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="bottom"
        sideOffset={0}
        collisionPadding={8}
        className="min-w-[200px] border-[#303030] bg-[#252525] p-1 text-white shadow-md"
      >
        <DropdownMenuLabel className="flex items-center gap-1.5 px-2 py-1.5">
          {EVENT_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={cn(
                "relative flex size-3 items-center justify-center rounded-xs",
                colorSwatchClass[color],
              )}
              onClick={() => handleColorSelect(color)}
              aria-label={t(`color_${color}`)}
              aria-pressed={color === currentColor}
            >
              {color === currentColor && <Check className="size-2 text-white" />}
            </button>
          ))}
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="-mx-1 bg-[#303030]" />

        <DropdownMenuItem
          className="text-[#E56458] hover:!bg-[#DE5551] hover:!text-white focus:!bg-[#DE5551] focus:!text-white [&:hover>svg]:!text-white [&:focus>svg]:!text-white"
          onSelect={() => onEventDelete?.(event)}
        >
          <Trash2 className="size-3.5 text-[#E56458]" />
          {t("delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>,
    document.body,
  );
}