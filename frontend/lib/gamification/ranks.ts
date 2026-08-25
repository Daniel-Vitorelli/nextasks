import type { RankDef } from "@/types/domain";

/**
 * Ranks derivados da faixa de nível. `minLevel` é cumulativo — o rank do
 * jogador é o último cujo minLevel ele alcançou. Curva alta de propósito:
 * subir de rank é evento raro e celebrado.
 */
export const RANKS: RankDef[] = [
  { id: "iniciante", nameKey: "ranks.iniciante", minLevel: 1, color: "gray", icon: "Sprout" },
  { id: "aprendiz", nameKey: "ranks.aprendiz", minLevel: 6, color: "green", icon: "BookOpen" },
  { id: "bronze", nameKey: "ranks.bronze", minLevel: 12, color: "orange", icon: "Medal" },
  { id: "prata", nameKey: "ranks.prata", minLevel: 20, color: "blue", icon: "Award" },
  { id: "ouro", nameKey: "ranks.ouro", minLevel: 30, color: "yellow", icon: "Trophy" },
  { id: "platina", nameKey: "ranks.platina", minLevel: 42, color: "purple", icon: "Gem" },
  { id: "diamante", nameKey: "ranks.diamante", minLevel: 56, color: "red", icon: "Diamond" },
  { id: "lendario", nameKey: "ranks.lendario", minLevel: 72, color: "green", icon: "Crown" },
];

/** Rank atual a partir do nível. */
export function rankFromLevel(level: number): RankDef {
  const lvl = Math.max(1, Math.floor(level));
  let current = RANKS[0];
  for (const rank of RANKS) {
    if (lvl >= rank.minLevel) current = rank;
  }
  return current;
}

/** Próximo rank (null quando já está no máximo). */
export function nextRank(level: number): RankDef | null {
  const lvl = Math.max(1, Math.floor(level));
  return RANKS.find((rank) => rank.minLevel > lvl) ?? null;
}
