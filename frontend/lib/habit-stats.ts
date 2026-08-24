import type { DailyProgress } from "@/types/domain";
import { parseHabitDaysOfWeek } from "@/types/domain";

const DAY_MS = 86_400_000;

/** Campos do hábito usados no cálculo de progresso diário. */
export interface HabitStatInput {
  frequency: string;
  daysOfWeek: string;
  targetCount: number;
  /** Início do dia local de criação do hábito (chave de dia). */
  createdAtDayMs: number;
}

/**
 * Progresso diário de um hábito na janela informada.
 *
 * - Diário: dias agendados recebem count/meta; os demais ficam com value
 *   null (não contam nem quebram o streak).
 * - Semanal: a meta vale para a semana; cada dia mostra o preenchimento da
 *   semana corrente (100% em todos os dias de uma semana completa).
 */
export function buildHabitProgress(
  habit: HabitStatInput,
  countsByDay: Map<number, number>,
  options: { dayStartMs: number; windowStartMs: number },
): DailyProgress[] {
  const target = Math.max(1, habit.targetCount);
  // Semanal não restringe dias: null = aplicável todos os dias.
  const scheduledDays =
    habit.frequency === "daily" ? parseHabitDaysOfWeek(habit) : null;

  const startMs = Math.max(options.windowStartMs, habit.createdAtDayMs);
  const progress: DailyProgress[] = [];

  for (
    let dayMs = startMs;
    dayMs <= options.dayStartMs;
    dayMs += DAY_MS
  ) {
    const weekday = new Date(dayMs).getUTCDay();

    if (scheduledDays !== null && !scheduledDays.includes(weekday)) {
      progress.push({
        date: new Date(dayMs).toISOString(),
        value: null,
        confirmableBlocks: 0,
        confirmedValue: 0,
      });
      continue;
    }

    let count: number;
    if (habit.frequency === "weekly") {
      const weekStartMs = dayMs - weekday * DAY_MS;
      let weekSum = 0;
      for (let key = weekStartMs; key <= dayMs; key += DAY_MS) {
        weekSum += countsByDay.get(key) ?? 0;
      }
      count = weekSum;
    } else {
      count = countsByDay.get(dayMs) ?? 0;
    }

    progress.push({
      date: new Date(dayMs).toISOString(),
      value: Math.round((Math.min(count, target) / target) * 100),
      confirmableBlocks: target,
      confirmedValue: count,
    });
  }

  return progress;
}
