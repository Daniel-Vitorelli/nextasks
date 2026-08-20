import type { useTranslations } from "next-intl";

import type { DayFilter, Frequency } from "@/types/domain";

export function formatLocalDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function todayLocal(): string {
  return formatLocalDate(new Date());
}

/** Próxima data local cujo dia da semana seja `weekday` (hoje incluso). */
export function nextDateForWeekday(weekday: number): string {
  const date = new Date();
  while (date.getDay() !== weekday) {
    date.setDate(date.getDate() + 1);
  }
  return formatLocalDate(date);
}

/** Dia da semana (0-6) de uma data local "YYYY-MM-DD". */
export function dateWeekday(dateString: string): number {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day).getDay();
}

export function isDateFilter(dayFilter: DayFilter): boolean {
  return dayFilter.startsWith("date:");
}

export function dayFilterDate(dayFilter: DayFilter): string {
  return dayFilter.slice("date:".length);
}

/**
 * O dayFilter é possível de satisfazer para este bloco? Blocos semanais só
 * ocorrem no próprio dia da semana: weekday de outro dia ou data em outro
 * dia da semana nunca casam. Blocos diários aceitam qualquer filtro.
 */
export function isDayFilterSatisfiable(
  dayFilter: DayFilter,
  frequency: Frequency,
  blockWeekday: number,
): boolean {
  if (dayFilter === "all" || frequency === "daily") return true;
  if (dayFilter.startsWith("weekday:")) {
    return Number(dayFilter.slice("weekday:".length)) === blockWeekday;
  }
  return dateWeekday(dayFilter.slice("date:".length)) === blockWeekday;
}

/** Rótulo da recorrência de um bloco ("Todos os dias" / "Toda quarta-feira"). */
export function blockRecurrence(
  frequency: Frequency,
  weekday: number,
  t: ReturnType<typeof useTranslations>,
): string {
  return frequency === "weekly"
    ? t("recurrenceWeekly", { day: t(`weekday_${weekday}`) })
    : t("recurrenceDaily");
}

/** Formata minutos desde meia-noite (0-1439) como "HH:MM" (ex.: 570 → "09:30"). */
export function formatClockTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

/** Rótulo do dayFilter de uma conexão ("Todos os dias" / dia da semana / data). */
export function dayFilterLabel(
  dayFilter: DayFilter,
  t: (key: string) => string,
): string {
  if (dayFilter === "all") return t("allDays");
  if (dayFilter.startsWith("weekday:")) {
    return t(`weekday_${Number(dayFilter.slice("weekday:".length))}`);
  }
  const [year, month, day] = dayFilter.slice("date:".length).split("-");
  return `${day}/${month}/${year}`;
}

/** Opções de filtro de dia válidas para um bloco (para o Select de filtro). */
export function dayFilterOptions(
  frequency: Frequency,
  blockWeekday: number,
): { value: DayFilter; labelKey: string; weekday?: number }[] {
  if (frequency === "weekly") {
    return [
      { value: "all", labelKey: "allDays" },
      {
        value: `weekday:${blockWeekday}` as DayFilter,
        labelKey: `weekday_${blockWeekday}`,
        weekday: blockWeekday,
      },
    ];
  }
  return [
    { value: "all", labelKey: "allDays" },
    ...[0, 1, 2, 3, 4, 5, 6].map((day) => ({
      value: `weekday:${day}` as DayFilter,
      labelKey: `weekday_${day}`,
      weekday: day,
    })),
  ];
}