import { describe, expect, it } from "vitest";

import {
  computeTaskReminders,
  isEndOfDayWindow,
  minutesUntilBlock,
} from "@/lib/server/reminders";

const DAY_MS = 86_400_000;
// Dia local arbitrário: 2030-06-10 00:00 UTC (segunda-feira).
const DAY_START = Date.UTC(2030, 5, 10);

function task(
  id: string,
  dueMs: number | null,
  title = `Task ${id}`,
): { id: string; title: string; dueDate: Date | null } {
  return { id, title, dueDate: dueMs === null ? null : new Date(dueMs) };
}

describe("computeTaskReminders", () => {
  it("notifica tarefas que vencem hoje", () => {
    const dueAtNoon = DAY_START + 12 * 3_600_000;
    const candidates = computeTaskReminders([task("t1", dueAtNoon)], DAY_START);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      kind: "task.due.today",
      refKey: `task:t1:${DAY_START}`,
      params: { title: "Task t1" },
    });
  });

  it("notifica tarefa recém-atrasada (venceu ontem) uma única vez", () => {
    const yesterdayEvening = DAY_START - 2 * 3_600_000;
    const candidates = computeTaskReminders([task("t1", yesterdayEvening)], DAY_START);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].kind).toBe("task.overdue");
    // refKey inclui o dia: não repete nos dias seguintes.
    expect(candidates[0].refKey).toBe(`task:t1:overdue:${DAY_START}`);
  });

  it("ignora atrasos antigos (mais de um dia)", () => {
    const lastWeek = DAY_START - 7 * DAY_MS + 3_600_000;
    const candidates = computeTaskReminders([task("t1", lastWeek)], DAY_START);
    expect(candidates).toHaveLength(0);
  });

  it("ignora vencimentos futuros e nulos", () => {
    const tomorrow = DAY_START + DAY_MS + 3_600_000;
    const candidates = computeTaskReminders(
      [task("t1", tomorrow), task("t2", null)],
      DAY_START,
    );
    expect(candidates).toHaveLength(0);
  });
});

describe("minutesUntilBlock", () => {
  const now = Date.UTC(2030, 5, 10, 10, 0);

  it("retorna minutos quando dentro do horizonte", () => {
    expect(minutesUntilBlock(now + 7 * 60_000, now, 15)).toBe(7);
    expect(minutesUntilBlock(now + 15 * 60_000, now, 15)).toBe(15);
  });

  it("ignora passado e horizonte distante", () => {
    expect(minutesUntilBlock(now - 60_000, now, 15)).toBeNull();
    expect(minutesUntilBlock(now + 16 * 60_000, now, 15)).toBeNull();
    expect(minutesUntilBlock(now, now, 15)).toBeNull();
  });

  it("arredonda segundos para minuto inteiro", () => {
    expect(minutesUntilBlock(now + 90_000, now, 15)).toBe(2); // 1.5 min → 2
  });
});

describe("isEndOfDayWindow", () => {
  it("dispara exatamente EOD_NUDGE_MINUTES antes da meia-noite (default 60)", () => {
    expect(isEndOfDayWindow(23 * 60)).toBe(true);
    expect(isEndOfDayWindow(22 * 60 + 59)).toBe(false);
    expect(isEndOfDayWindow(23 * 60 + 1)).toBe(false);
    expect(isEndOfDayWindow(0)).toBe(false);
  });
});
