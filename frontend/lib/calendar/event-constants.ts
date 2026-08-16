import type { EventColor, EventConfirmation } from "@/types/domain";

/** Cores disponíveis para blocos de tempo. */
export const EVENT_COLORS: readonly EventColor[] = [
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "gray",
];

/** Modos de confirmação de um bloco (nenhum, checklist ou nota 1-10). */
export const CONFIRMATION_OPTIONS: readonly EventConfirmation[] = [
  "none",
  "checklist",
  "score",
];