import type { DailyProgress } from "@/types/domain";
import { parseHabitDaysOfWeek } from "@/types/domain";

const DAY_MS = 86_400_000;

/** Campos do hábito usados no cálculo de progresso diário. */
export interface HabitStatInput {
  frequency: string;
  daysOfWeek: string;
  targetCount: number;
  /** good = quer manter; bad = quer largar. */
  type?: string;
  /** Início do dia local de criação do hábito (chave de dia). */
  createdAtDayMs: number;
}

/**
 * Progresso diário de um hábito na janela informada.
 *
 * Bons hábitos:
 * - Diário: dias agendados recebem count/meta; os demais ficam com value
 *   null (não contam nem quebram o streak).
 * - Semanal: a meta vale para a semana; cada dia mostra o preenchimento da
 *   semana corrente (100% em todos os dias de uma semana completa).
 *
 * Hábitos ruins (lógica invertida — ausência de marcação é sucesso):
 * - value 100 = dia limpo (sem recaídas), 0 = houve recaída.
 * - Diário segue a agenda; semanal: qualquer recaída na semana zera todos
 *   os dias já decorridos dessa semana.
 */
export function buildHabitProgress(
  habit: HabitStatInput,
  countsByDay: Map<number, number>,
  options: { dayStartMs: number; windowStartMs: number },
): DailyProgress[] {
  const isBad = habit.type === "bad";
  const target = Math.max(1, habit.targetCount);
  // Semanal não restringe dias; ruins são rastreados todos os dias.
  const scheduledDays =
    !isBad && habit.frequency === "daily"
      ? parseHabitDaysOfWeek(habit)
      : null;

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
    let value: number;
    if (habit.frequency === "weekly") {
      const weekStartMs = dayMs - weekday * DAY_MS;
      let weekSum = 0;
      for (let key = weekStartMs; key <= dayMs; key += DAY_MS) {
        weekSum += countsByDay.get(key) ?? 0;
      }
      count = weekSum;
      value = isBad
        ? weekSum > 0
          ? 0
          : 100
        : Math.round((Math.min(count, target) / target) * 100);
    } else {
      count = countsByDay.get(dayMs) ?? 0;
      value = isBad ? (count > 0 ? 0 : 100) : Math.round((Math.min(count, target) / target) * 100);
    }

    progress.push({
      date: new Date(dayMs).toISOString(),
      value,
      confirmableBlocks: isBad ? 1 : target,
      confirmedValue: count,
    });
  }

  return progress;
}
