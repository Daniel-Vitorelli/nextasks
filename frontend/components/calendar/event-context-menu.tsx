"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Check, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { CalendarEvent, EventColor } from "@/types/calendar";
import { EVENT_COLORS } from "@/lib/calendar/event-constants";
import { colorSwatchClass } from "./calendar-event-color";

interface EventContextMenuProps {
  event: CalendarEvent;
  position: { x: number; y: number };
  onClose: () => void;
  onEventChange?: (event: CalendarEvent) => void;
  onEventDelete?: (event: CalendarEvent) => void;
}

function MenuItem({
  className,
  children,
  onSelect,
}: {
  className?: string;
  children: React.ReactNode;
  onSelect?: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "relative flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-xs outline-none select-none",
        "text-white hover:bg-[#303030] focus:bg-[#303030]",
        className,
      )}
      onClick={onSelect}
    >
      {children}
    </button>
  );
}

function Shortcut({ children }: { children: React.ReactNode }) {
  return <span className="ml-auto text-xs text-white/40">{children}</span>;
}

function Separator() {
  return <div className="-mx-1 my-1 h-px bg-[#303030]" />;
}

export function EventContextMenu({
  event,
  position,
  onClose,
  onEventChange,
  onEventDelete,
}: EventContextMenuProps) {
  const t = useTranslations("dashboard.routines.calendar");
  const menuRef = React.useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = React.useState(position);
  const [ready, setReady] = React.useState(false);
  const currentColor = event.color ?? "green";

  React.useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;

    const menuHeight = menu.offsetHeight;
    const menuWidth = menu.offsetWidth;
    let y = position.y;
    let x = position.x;

    if (position.y + menuHeight > window.innerHeight) {
      y = position.y - menuHeight;
    }
    if (position.x + menuWidth > window.innerWidth) {
      x = position.x - menuWidth;
    }

    setAdjustedPos({ x, y });
    setReady(true);
  }, [position]);

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!menuRef.current) return;
      if (menuRef.current.contains(e.target as Node)) return;
      onClose();
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      onClose();
    }

    // Use capture to close before other handlers fire
    document.addEventListener("mousedown", handleClickOutside, true);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside, true);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  function handleColorSelect(color: EventColor) {
    onEventChange?.({ ...event, color });
    onClose();
  }

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[200px] rounded-sm border border-[#303030] bg-[#252525] p-1 shadow-md animate-in fade-in-0 zoom-in-95"
      style={{
        top: adjustedPos.y,
        left: adjustedPos.x,
        opacity: ready ? 1 : 0,
      }}
    >
      {/* Color selector row */}
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        {EVENT_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className={cn(
              "relative flex size-3 items-center justify-center rounded-xs",
              colorSwatchClass[color],
            )}
            onClick={() => handleColorSelect(color)}
          >
            {color === currentColor && <Check className="size-2 text-white" />}
          </button>
        ))}
      </div>

      <Separator />

      {/* Delete */}
      <MenuItem
        className="text-[#E56458] hover:!bg-[#DE5551] hover:!text-white focus:!bg-[#DE5551] focus:!text-white [&:hover>svg]:!text-white [&:focus>svg]:!text-white [&:hover>.ml-auto]:!text-white [&:focus>.ml-auto]:!text-white"
        onSelect={() => onEventDelete?.(event)}
      >
        <Trash2 className="size-3.5 text-[#E56458]" />
        {t("delete")}
        <Shortcut>delete</Shortcut>
      </MenuItem>
    </div>,
    document.body,
  );
}
