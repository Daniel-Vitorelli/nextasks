import type { DailyProgress, StreakStats } from "@/types/domain";

const DAY_MS = 86_400_000;

/**
 * Dias com o dia 100% completo, como chaves de dia (início do dia local,
 * normalizadas para o mesmo fuso em todos os pontos do progresso).
 */
function fullDayKeys(progress: DailyProgress[]): Set<number> {
  return new Set(
    progress
      .filter((day) => day.value === 100)
      .map((day) => Math.floor(new Date(day.date).getTime() / DAY_MS)),
  );
}

/**
 * Sequência de dias 100% completos a partir do progresso da rotina.
 *
 * - `current`: dias consecutivos 100% terminando no último dia completo,
 *   desde que ele seja hoje ou ontem (se o último dia 100% foi há 2+ dias,
 *   a sequência está quebrada e vale 0 — hoje incompleto ainda não quebra).
 * - `longest`: maior corrida consecutiva de dias 100% em qualquer momento.
 * - `lastFullDay`: data local (ISO) do último dia 100% completo.
 */
export function computeStreak(
  progress: DailyProgress[],
  today: Date,
): StreakStats {
  if (progress.length === 0) {
    return { current: 0, longest: 0, lastFullDay: null };
  }

  const keys = fullDayKeys(progress);
  if (keys.size === 0) {
    return { current: 0, longest: 0, lastFullDay: null };
  }

  const sorted = [...keys].sort((a, b) => a - b);
  let longest = 0;
  let run = 0;
  let previous = Number.NaN;
  for (const key of sorted) {
    run = key === previous + 1 ? run + 1 : 1;
    if (run > longest) longest = run;
    previous = key;
  }

  const lastFullKey = sorted[sorted.length - 1];
  const todayKey = Math.floor(today.getTime() / DAY_MS);
  let current = 0;
  if (lastFullKey === todayKey || lastFullKey === todayKey - 1) {
    for (let key = lastFullKey; keys.has(key); key -= 1) {
      current += 1;
    }
  }

  return {
    current,
    longest,
    lastFullDay: new Date(lastFullKey * DAY_MS).toISOString(),
  };
}