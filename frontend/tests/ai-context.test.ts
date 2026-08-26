import { describe, expect, it } from "vitest";

import { buildSystemPrompt, type AiContextData } from "@/lib/server/ai/context";
import { parseFactArray } from "@/lib/server/ai/memory";

function contextData(overrides: Partial<AiContextData> = {}): AiContextData {
  return {
    userName: "Daniel",
    locale: "pt",
    today: "2026-08-25",
    weekday: "terça-feira",
    pendingTasks: [],
    upcomingTasks: [],
    habitsToday: [],
    routineDay: null,
    stats: {
      totalXp: 0,
      level: 1,
      currentRoutineStreak: 0,
      bestCleanStreak: 0,
      tasksDone: 0,
      blocksConfirmed: 0,
    },
    memoryFacts: [],
    ...overrides,
  };
}

describe("buildSystemPrompt", () => {
  it("inclui instruções de aconselhamento e dados do dia", () => {
    const prompt = buildSystemPrompt(
      contextData({
        pendingTasks: [{ title: "Enviar relatório", priority: 6, dueDate: "2026-08-25" }],
        routineDay: {
          routineName: "Manhã produtiva",
          blocks: [
            { title: "Alongamento", time: "07:00–07:15", confirmed: true },
            { title: "Leitura", time: "07:30–08:00", confirmed: false },
          ],
        },
      }),
    );

    expect(prompt).toContain("NexTasks");
    expect(prompt).toContain("2026-08-25");
    expect(prompt).toContain("Manhã produtiva");
    expect(prompt).toContain("[x] 07:00–07:15 Alongamento");
    expect(prompt).toContain("[ ] 07:30–08:00 Leitura");
    expect(prompt).toContain("Enviar relatório");
    // Nunca deve instruir o modelo a executar ações.
    expect(prompt.toLowerCase()).toContain("aconselha");
  });

  it("inclui fatos de memória e stats de gamificação", () => {
    const prompt = buildSystemPrompt(
      contextData({
        memoryFacts: ["Prefere treinar de manhã"],
        stats: {
          totalXp: 1234,
          level: 5,
          currentRoutineStreak: 3,
          bestCleanStreak: 10,
          tasksDone: 42,
          blocksConfirmed: 100,
        },
      }),
    );

    expect(prompt).toContain("Prefere treinar de manhã");
    expect(prompt).toContain("1234");
    expect(prompt).toContain("Nível: 5");
  });

  it("respeita o locale en", () => {
    const prompt = buildSystemPrompt(contextData({ locale: "en", userName: "Daniel" }));
    expect(prompt).toContain("answer in English");
    expect(prompt).not.toContain("português");
  });

  it("não menciona seções vazias", () => {
    const prompt = buildSystemPrompt(contextData());
    expect(prompt).not.toContain("Tarefas pendentes");
    expect(prompt).not.toContain("Hábitos de hoje");
    expect(prompt).not.toContain("lembra sobre");
  });
});

describe("parseFactArray", () => {
  it("extrai array JSON puro", () => {
    expect(parseFactArray('["Treina de manhã", "Meta de água: 2L"]')).toEqual([
      "Treina de manhã",
      "Meta de água: 2L",
    ]);
  });

  it("extrai array cercado por texto ou code fence", () => {
    const raw = 'Aqui está:\n```json\n["fato novo"]\n```\nFim.';
    expect(parseFactArray(raw)).toEqual(["fato novo"]);
  });

  it("retorna vazio em respostas inválidas ou [] ", () => {
    expect(parseFactArray("[]")).toEqual([]);
    expect(parseFactArray("sem json aqui")).toEqual([]);
    expect(parseFactArray('{"não": "é array"}')).toEqual([]);
  });

  it("filtra entradas não-string e strings vazias/longas", () => {
    const raw = JSON.stringify(["ok", "", 42, "x".repeat(301)]);
    expect(parseFactArray(raw)).toEqual(["ok"]);
  });
});
