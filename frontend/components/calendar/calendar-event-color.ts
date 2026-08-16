import type { EventColor } from "@/types/calendar";
import { EVENT_COLORS } from "@/lib/calendar/event-constants";

export const colorSwatchClass: Record<EventColor, string> = {
  red: "bg-event-red-border",
  orange: "bg-event-orange-border",
  yellow: "bg-event-yellow-border",
  green: "bg-event-green-border",
  blue: "bg-event-blue-border",
  purple: "bg-event-purple-border",
  gray: "bg-event-gray-border",
};

export interface EventColorStyles {
  bg: string;
  bgHover: string;
  border: string;
  borderLine: string;
  text: string;
  /** Borda do card na cor do bloco, no hover. */
  borderHover: string;
  /** Fundo solido (accent) na cor do bloco, para botoes/slider/switch. */
  accentBg: string;
  accentBgHover: string;
  /** Borda solida na cor do bloco (ex.: thumb do slider). */
  accentBorder: string;
  /** Estado marcado do switch na cor do bloco. */
  checkedBg: string;
}

export const eventColorStyles: Record<EventColor, EventColorStyles> = {
  red: {
    bg: "bg-event-red-bg",
    bgHover: "hover:bg-event-red-bg/70",
    border: "bg-event-red-border",
    borderLine: "border-event-red-border",
    text: "text-event-red",
    borderHover: "hover:border-event-red-border",
    accentBg: "!bg-event-red-border",
    accentBgHover: "hover:!bg-event-red-border/80",
    accentBorder: "!border-event-red-border",
    checkedBg: "data-[state=checked]:!bg-event-red-border",
  },
  orange: {
    bg: "bg-event-orange-bg",
    bgHover: "hover:bg-event-orange-bg/70",
    border: "bg-event-orange-border",
    borderLine: "border-event-orange-border",
    text: "text-event-orange",
    borderHover: "hover:border-event-orange-border",
    accentBg: "!bg-event-orange-border",
    accentBgHover: "hover:!bg-event-orange-border/80",
    accentBorder: "!border-event-orange-border",
    checkedBg: "data-[state=checked]:!bg-event-orange-border",
  },
  yellow: {
    bg: "bg-event-yellow-bg",
    bgHover: "hover:bg-event-yellow-bg/70",
    border: "bg-event-yellow-border",
    borderLine: "border-event-yellow-border",
    text: "text-event-yellow",
    borderHover: "hover:border-event-yellow-border",
    accentBg: "!bg-event-yellow-border",
    accentBgHover: "hover:!bg-event-yellow-border/80",
    accentBorder: "!border-event-yellow-border",
    checkedBg: "data-[state=checked]:!bg-event-yellow-border",
  },
  green: {
    bg: "bg-event-green-bg",
    bgHover: "hover:bg-event-green-bg/70",
    border: "bg-event-green-border",
    borderLine: "border-event-green-border",
    text: "text-event-green",
    borderHover: "hover:border-event-green-border",
    accentBg: "!bg-event-green-border",
    accentBgHover: "hover:!bg-event-green-border/80",
    accentBorder: "!border-event-green-border",
    checkedBg: "data-[state=checked]:!bg-event-green-border",
  },
  blue: {
    bg: "bg-event-blue-bg",
    bgHover: "hover:bg-event-blue-bg/70",
    border: "bg-event-blue-border",
    borderLine: "border-event-blue-border",
    text: "text-event-blue",
    borderHover: "hover:border-event-blue-border",
    accentBg: "!bg-event-blue-border",
    accentBgHover: "hover:!bg-event-blue-border/80",
    accentBorder: "!border-event-blue-border",
    checkedBg: "data-[state=checked]:!bg-event-blue-border",
  },
  purple: {
    bg: "bg-event-purple-bg",
    bgHover: "hover:bg-event-purple-bg/70",
    border: "bg-event-purple-border",
    borderLine: "border-event-purple-border",
    text: "text-event-purple",
    borderHover: "hover:border-event-purple-border",
    accentBg: "!bg-event-purple-border",
    accentBgHover: "hover:!bg-event-purple-border/80",
    accentBorder: "!border-event-purple-border",
    checkedBg: "data-[state=checked]:!bg-event-purple-border",
  },
  gray: {
    bg: "bg-event-gray-bg",
    bgHover: "hover:bg-event-gray-bg/70",
    border: "bg-event-gray-border",
    borderLine: "border-event-gray-border",
    text: "text-event-gray",
    borderHover: "hover:border-event-gray-border",
    accentBg: "!bg-event-gray-border",
    accentBgHover: "hover:!bg-event-gray-border/80",
    accentBorder: "!border-event-gray-border",
    checkedBg: "data-[state=checked]:!bg-event-gray-border",
  },
};
