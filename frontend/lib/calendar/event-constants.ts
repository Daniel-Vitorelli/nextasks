import type { EventConfirmation } from "@/types/domain";

/** Cores disponíveis para blocos de tempo. */
export const EVENT_COLORS = [
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "gray",
] as const;

/** Modos de confirmação de um bloco (nenhum, checklist ou nota 1-10). */
export const CONFIRMATION_OPTIONS: readonly EventConfirmation[] = [
  "none",
  "checklist",
  "score",
];