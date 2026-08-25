/**
 * Utilitários de sequência sobre unidades consecutivas (dias ou semanas
 * representados como inteiros crescentes).
 */

export interface StreakSummary {
  /** Maior corrida consecutiva em qualquer ponto. */
  best: number;
  /**
   * Corrida terminando na referência (hoje) ou imediatamente antes dela
   * (ontem) — hoje incompleto ainda não quebra a sequência.
   */
  current: number;
}

/**
 * Resume best/current a partir de unidades ORDENADAS e únicas.
 * `referenceUnit` é a unidade corrente (dia de hoje / semana corrente).
 */
export function streakSummary(
  sortedUniqueUnits: number[],
  referenceUnit: number,
): StreakSummary {
  let best = 0;
  let run = 0;
  let prev = Number.NaN;
  for (const unit of sortedUniqueUnits) {
    run = unit === prev + 1 ? run + 1 : 1;
    if (run > best) best = run;
    prev = unit;
  }

  const present = new Set(sortedUniqueUnits);
  const anchor = present.has(referenceUnit)
    ? referenceUnit
    : present.has(referenceUnit - 1)
      ? referenceUnit - 1
      : null;

  let current = 0;
  if (anchor !== null) {
    for (let unit = anchor; present.has(unit); unit -= 1) current += 1;
  }

  return { best, current };
}
