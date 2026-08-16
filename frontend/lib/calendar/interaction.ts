/**
 * Constantes e helpers compartilhados pelas interações de drag/resize
 * do calendário (arrasto de blocos com hora, redimensionamento e all-day).
 */

/** Movimento (px) necessário para iniciar o arrasto com mouse. */
export const DRAG_THRESHOLD_PX = 4;

/** Movimento (px) necessário para iniciar o arrasto com toque. */
export const TOUCH_SLOP_PX = 10;

/** Passo do snap dos horários, em minutos. */
export const SNAP_MINUTES = 15;

/** Duração mínima de um bloco ao redimensionar, em minutos. */
export const MIN_DURATION_MINUTES = 15;

/** Distância (px) das bordas do grid que dispara a navegação entre semanas. */
export const EDGE_ZONE_PX = 40;

/** Atraso inicial da navegação por borda, em ms. */
export const EDGE_NAV_DELAY_MS = 500;

/** Intervalo de repetição da navegação por borda, em ms. */
export const EDGE_NAV_REPEAT_MS = 800;

/** Distância (px) das bordas verticais que dispara o auto-scroll. */
export const AUTO_SCROLL_ZONE_PX = 60;

/** Velocidade máxima do auto-scroll, em px por frame. */
export const AUTO_SCROLL_MAX_SPEED = 12;

/** Arredonda minutos para o passo de snap mais próximo. */
export function snapToGrid(minutes: number): number {
  return Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;
}

/** Nova Date com a data zerada e o total de minutos aplicado ao dia. */
export function addMinutesToDate(date: Date, minutes: number): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  result.setMinutes(minutes);
  return result;
}

/** Restringe um valor ao intervalo [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}