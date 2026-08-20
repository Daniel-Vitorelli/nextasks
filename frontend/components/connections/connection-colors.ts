import { eventColorStyles } from "@/components/calendar/calendar-event-color";
import type { EventColor } from "@/types/domain";

/** Classe de fundo sólido na cor do bloco (ex.: bg-event-green-border). */
export function blockBorderClass(color: EventColor): string {
  return eventColorStyles[color].border;
}

/** Classe de fundo tintado na cor do bloco (ex.: bg-event-green-bg). */
export function blockTintClass(color: EventColor): string {
  return eventColorStyles[color].bg;
}

/** Classe de texto na cor do bloco (ex.: text-event-green). */
export function blockTextClass(color: EventColor): string {
  return eventColorStyles[color].text;
}

/** Cor de texto legível sobre o fundo sólido do bloco. */
export const solidTextOnColor: Record<EventColor, string> = {
  red: "text-white",
  orange: "text-white",
  yellow: "text-black/80",
  green: "text-white",
  blue: "text-white",
  purple: "text-white",
  gray: "text-white",
};