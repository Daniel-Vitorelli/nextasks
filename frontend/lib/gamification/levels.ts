/**
 * Curva de níveis: XP acumulado necessário para alcançar o nível L é
 * 75 · (L−1) · L ÷ 2 (quadrática suave). Constante ajustável em um só lugar.
 *
 * Ex.: nível 2 @75, 3 @225, 5 @600, 10 @3.375, 20 @14.250, 30 @31.725.
 */

const CURVE_COEFFICIENT = 75;

/** XP acumulado total necessário para estar NO nível informado (mínimo 1). */
export function cumulativeXpForLevel(level: number): number {
  const l = Math.max(1, Math.floor(level));
  return (CURVE_COEFFICIENT * (l - 1) * l) / 2;
}

/** Nível atual a partir do XP total. */
export function levelFromXp(totalXp: number): number {
  const xp = Math.max(0, Math.floor(totalXp));
  // Inversão da quadrática + ajuste para o teto exato do nível.
  const approx = (1 + Math.sqrt(1 + (8 * xp) / CURVE_COEFFICIENT)) / 2;
  let level = Math.floor(approx);
  while (cumulativeXpForLevel(level + 1) <= xp && level < 999) level += 1;
  while (level > 1 && cumulativeXpForLevel(level) > xp) level -= 1;
  return level;
}

/** Progresso (0-100) dentro do nível atual e XP que falta para o próximo. */
export function levelProgress(totalXp: number): {
  progress: number;
  xpToNextLevel: number;
} {
  const level = levelFromXp(totalXp);
  const floor = cumulativeXpForLevel(level);
  const ceiling = cumulativeXpForLevel(level + 1);
  const span = Math.max(1, ceiling - floor);
  return {
    progress: Math.min(100, Math.round(((totalXp - floor) / span) * 100)),
    xpToNextLevel: Math.max(0, ceiling - totalXp),
  };
}
