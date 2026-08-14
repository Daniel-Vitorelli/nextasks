import type { Period } from "@/types/domain";

/**
 * Inicio do dia local (do usuario) como instante UTC.
 * `date` e um instante UTC; o offset do usuario e aplicado para truncar
 * no dia correto e voltar para UTC.
 */
export function startOfDayUtc(date: Date, tzOffsetMinutes = 0): Date {
  const local = new Date(date.getTime() - tzOffsetMinutes * 60_000);
  const localStart = new Date(
    local.getFullYear(),
    local.getMonth(),
    local.getDate(),
  );
  return new Date(localStart.getTime() + tzOffsetMinutes * 60_000);
}

/** Inicio da semana local (domingo 00:00) como instante UTC. */
export function startOfWeekUtc(date: Date, tzOffsetMinutes = 0): Date {
  const dayStart = startOfDayUtc(date, tzOffsetMinutes);
  const local = new Date(dayStart.getTime() - tzOffsetMinutes * 60_000);
  return new Date(dayStart.getTime() - local.getDay() * 86_400_000);
}

/**
 * Periodo de validade de uma confirmacao para um bloco.
 * - Rotina diaria: o dia local (+24h)
 * - Rotina semanal: a semana local (domingo 00:00, +7 dias)
 */
export function periodForFrequency(
  frequency: "daily" | "weekly",
  now: Date,
  tzOffsetMinutes = 0,
): Period {
  const isWeekly = frequency === "weekly";
  const start = isWeekly
    ? startOfWeekUtc(now, tzOffsetMinutes)
    : startOfDayUtc(now, tzOffsetMinutes);
  const end = new Date(start.getTime() + (isWeekly ? 7 : 1) * 86_400_000);
  return { start, end };
}

/** Dia da semana (0-6) de um instante UTC no fuso do usuario. */
export function localWeekday(date: Date, tzOffsetMinutes = 0): number {
  return new Date(date.getTime() - tzOffsetMinutes * 60_000).getDay();
}

/** Minutos do dia (0-1439) de um instante UTC no fuso do usuario. */
export function localMinutesOfDay(date: Date, tzOffsetMinutes = 0): number {
  const local = new Date(date.getTime() - tzOffsetMinutes * 60_000);
  return local.getHours() * 60 + local.getMinutes();
}
