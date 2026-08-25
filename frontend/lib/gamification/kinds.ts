/**
 * Mapeia kind do ledger para a folha de tradução em
 * app.gamification.history.kinds.<leaf> (folhas sem ponto: next-intl usa
 * "." como separador de caminho).
 */
export const XP_KIND_LABEL_KEYS: Record<string, string> = {
  "block.confirm": "blockConfirm",
  "task.done": "taskDone",
  "subtask.done": "subtaskDone",
  "habit.confirm": "habitConfirm",
  "habit.target": "habitTarget",
  "habit.slip": "habitSlip",
  "routine.dayFull": "routineDayFull",
  achievement: "achievement",
};

/** Rótulo seguro: folha conhecida ou o kind cru como fallback. */
export function xpKindLabelKey(kind: string): string {
  return XP_KIND_LABEL_KEYS[kind] ?? kind;
}
