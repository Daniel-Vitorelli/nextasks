import { describe, expect, it } from "vitest";

import { buildHabitProgress } from "@/lib/habit-stats";
import { computeStreak } from "@/lib/streak";

const DAY_MS = 86_400_000;

// Segunda-feira 2024-06-03 em meia-noite UTC como "hoje".
const TODAY_MS = Date.UTC(2024, 5, 3);

function days(count: number) {
  return {
    dayStartMs: TODAY_MS,
    windowStartMs: TODAY_MS - (count - 1) * DAY_MS,
  };
}

describe("buildHabitProgress", () => {
  it("hábito semanal é aplicável todos os dias", () => {
    const progress = buildHabitProgress(
      {
        frequency: "weekly",
        daysOfWeek: "[]",
        targetCount: 1,
        createdAtDayMs: TODAY_MS - 6 * DAY_MS,
      },
      new Map(),
      days(7),
    );
    expect(progress).toHaveLength(7);
    expect(progress.every((day) => day.value === 0)).toBe(true);
  });

  it("dias fora da agenda ficam null e não quebram o streak", () => {
    // Agenda seg/qua (1,3); janela dom(2/6)..seg(3/6): só segunda aplicável.
    const progress = buildHabitProgress(
      {
        frequency: "daily",
        daysOfWeek: "[1,3]",
        targetCount: 2,
        createdAtDayMs: TODAY_MS - 6 * DAY_MS,
      },
      new Map([[TODAY_MS, 2]]),
      days(2),
    );

    expect(progress[0].value).toBeNull(); // domingo
    expect(progress[1].value).toBe(100); // segunda completa

    const streak = computeStreak(progress, new Date(TODAY_MS));
    expect(streak.current).toBe(1);
    expect(streak.longest).toBe(1);
  });

  it("meta parcial gera valor proporcional", () => {
    const progress = buildHabitProgress(
      {
        frequency: "daily",
        daysOfWeek: "[1]",
        targetCount: 4,
        createdAtDayMs: TODAY_MS,
      },
      new Map([[TODAY_MS, 3]]),
      days(1),
    );
    expect(progress[0].value).toBe(75);
  });

  it("semanal soma a semana corrente e satura na meta", () => {
    // Hoje é segunda. Janela: terça anterior .. hoje (7 dias).
    // Marcações: quarta e quinta da semana passada (2+1=meta 3) e hoje (1).
    const counts = new Map<number, number>([
      [TODAY_MS - 5 * DAY_MS, 2],
      [TODAY_MS - 4 * DAY_MS, 1],
      [TODAY_MS, 1],
    ]);
    const progress = buildHabitProgress(
      {
        frequency: "weekly",
        daysOfWeek: "[]",
        targetCount: 3,
        createdAtDayMs: TODAY_MS - 60 * DAY_MS,
      },
      counts,
      days(7),
    );

    // Terça: semana começa no domingo seguinte — nada marcado ainda.
    expect(progress[0].value).toBe(0);
    // Quarta: 2/3.
    expect(progress[1].value).toBe(67);
    // Quinta e sábado: semana fechou com 3 → 100%.
    expect(progress[2].value).toBe(100);
    expect(progress[3].value).toBe(100);
    expect(progress[4].value).toBe(100);
    // Domingo já é a semana nova (semanas começam no domingo): ainda 0.
    expect(progress[5].value).toBe(0);
    // Hoje (segunda): mesma semana nova com 1/3.
    expect(progress[6].value).toBe(33);
  });

  it("soma semanal considera dias antes da janela informada", () => {
    // Janela de 1 dia (hoje), mas a semana tem marcações desde o domingo.
    const sundayMs = TODAY_MS - DAY_MS;
    const progress = buildHabitProgress(
      {
        frequency: "weekly",
        daysOfWeek: "[]",
        targetCount: 2,
        createdAtDayMs: TODAY_MS - 60 * DAY_MS,
      },
      new Map([
        [sundayMs, 2],
        [TODAY_MS, 0],
      ]),
      days(1),
    );
    expect(progress[0].value).toBe(100);
  });

  it("janela é limitada pela criação do hábito", () => {
    const progress = buildHabitProgress(
      {
        frequency: "daily",
        daysOfWeek: "[]",
        targetCount: 1,
        createdAtDayMs: TODAY_MS - 2 * DAY_MS,
      },
      new Map(),
      days(7),
    );
    expect(progress).toHaveLength(3);
  });

  it("hábito ruim: dia sem recaída vale 100 e com recaída vale 0", () => {
    // Hoje é segunda; janela dom..seg. Recaída só no domingo.
    const progress = buildHabitProgress(
      {
        frequency: "daily",
        daysOfWeek: "[0,1]",
        targetCount: 1,
        type: "bad",
        createdAtDayMs: TODAY_MS - 60 * DAY_MS,
      },
      new Map([[TODAY_MS - DAY_MS, 1]]),
      days(2),
    );

    expect(progress[0].value).toBe(0); // domingo com recaída
    expect(progress[1].value).toBe(100); // segunda limpa

    const streak = computeStreak(progress, new Date(TODAY_MS));
    expect(streak.current).toBe(1); // segunda limpa encadeia
    expect(streak.longest).toBe(1);
  });

  it("hábito ruim: ausência de marcações gera streak contínuo", () => {
    // Ruins são rastreados todos os dias, independente da agenda salva.
    const progress = buildHabitProgress(
      {
        frequency: "daily",
        daysOfWeek: "[1]",
        targetCount: 1,
        type: "bad",
        createdAtDayMs: TODAY_MS - 60 * DAY_MS,
      },
      new Map(),
      days(8),
    );

    expect(progress.every((day) => day.value === 100)).toBe(true);
    const streak = computeStreak(progress, new Date(TODAY_MS));
    expect(streak.current).toBe(8);
  });

  it("hábito ruim semanal: qualquer recaída zera os dias decorridos da semana", () => {
    // Recaída no domingo (início da semana corrente); hoje é segunda.
    const progress = buildHabitProgress(
      {
        frequency: "weekly",
        daysOfWeek: "[]",
        targetCount: 1,
        type: "bad",
        createdAtDayMs: TODAY_MS - 60 * DAY_MS,
      },
      new Map([[TODAY_MS - DAY_MS, 2]]),
      days(2),
    );

    expect(progress[0].value).toBe(0);
    expect(progress[1].value).toBe(0);

    // Semana anterior inteira limpa: streak de dias limpos até sábado.
    const cleanWeek = buildHabitProgress(
      {
        frequency: "weekly",
        daysOfWeek: "[]",
        targetCount: 1,
        type: "bad",
        createdAtDayMs: TODAY_MS - 60 * DAY_MS,
      },
      new Map(),
      days(9),
    );
    const streak = computeStreak(cleanWeek, new Date(TODAY_MS));
    expect(streak.current).toBeGreaterThanOrEqual(2);
    expect(streak.lastFullDay).not.toBeNull();
  });
});
