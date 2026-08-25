/**
 * Tabela declarativa de regras de XP — fonte única editável.
 * Valores aqui alimentam a aba "Como ganhar" da página de gamificação.
 */

export const XP_AMOUNTS = {
  blockChecklist: 10,
  blockScorePerPoint: 1,
  taskDone: 20,
  subtaskDone: 10,
  habitConfirm: 5,
  habitTargetBonus: 10,
  habitSlip: -15,
  routineDayFull: 25,
} as const;

/** Recompensa de XP por tier de conquista. */
export const ACHIEVEMENT_TIER_XP: Record<string, number> = {
  bronze: 50,
  silver: 100,
  gold: 250,
  platinum: 500,
};
