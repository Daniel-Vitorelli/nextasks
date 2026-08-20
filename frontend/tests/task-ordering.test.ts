import { describe, expect, it } from "vitest";
import {
  dueUrgencyScore,
  sortPendingTasks,
  sortTasksForList,
  taskUrgencyScore,
} from "@/lib/task-ordering";
import type { Task } from "@/types/domain";

const NOW = new Date("2024-01-10T12:00:00.000Z");

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: Math.random().toString(36),
    title: "T",
    description: null,
    dueDate: null,
    priority: 3,
    done: false,
    createdAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("dueUrgencyScore", () => {
  it("sem data vale 0", () => {
    expect(dueUrgencyScore(null, NOW)).toBe(0);
  });

  it("atrasada cresce com o atraso (10 a 15)", () => {
    const monthLate = dueUrgencyScore("2024-01-01T00:00:00.000Z", NOW);
    const daysLate = dueUrgencyScore("2024-01-08T00:00:00.000Z", NOW);
    expect(monthLate).toBe(15);
    expect(daysLate).toBeGreaterThan(10);
    expect(daysLate).toBeLessThan(monthLate);
  });

  it("vence hoje fica entre 8 e 10", () => {
    const score = dueUrgencyScore("2024-01-10T12:00:00.000Z", NOW);
    expect(score).toBeGreaterThanOrEqual(8);
    expect(score).toBeLessThan(10);
  });

  it("vence em 3 dias fica entre 6 e 8", () => {
    const score = dueUrgencyScore("2024-01-12T00:00:00.000Z", NOW);
    expect(score).toBeGreaterThanOrEqual(6);
    expect(score).toBeLessThan(8);
  });

  it("muito distante tende a 0", () => {
    expect(dueUrgencyScore("2025-01-01T00:00:00.000Z", NOW)).toBeLessThan(4);
  });
});

describe("taskUrgencyScore", () => {
  it("soma prioridade + urgência da data", () => {
    expect(taskUrgencyScore({ priority: 6, dueDate: null }, NOW)).toBe(6);
    expect(
      taskUrgencyScore(
        { priority: 3, dueDate: "2024-01-10T00:00:00.000Z" },
        NOW,
      ),
    ).toBeGreaterThan(10);
  });
});

describe("sortPendingTasks", () => {
  it("ordena por urgência decrescente", () => {
    const tasks = [
      task({ id: "a", priority: 1, dueDate: null }),
      task({ id: "b", priority: 6, dueDate: null }),
      task({ id: "c", priority: 3, dueDate: "2024-01-11T00:00:00.000Z" }),
    ];
    const sorted = sortPendingTasks(tasks, NOW);
    expect(sorted[0].id).toBe("c");
    expect(sorted[1].id).toBe("b");
    expect(sorted[2].id).toBe("a");
  });

  it("não muta a lista original", () => {
    const tasks = [
      task({ id: "a", createdAt: "2024-01-02T00:00:00.000Z" }),
      task({ id: "b" }),
    ];
    const sorted = sortPendingTasks(tasks, NOW);
    expect(tasks[0].id).toBe("a");
    expect(sorted[0].id).toBe("b");
  });
});

describe("sortTasksForList", () => {
  it("concluídas por último, depois prioridade desc, depois mais recente", () => {
    const tasks = [
      task({ id: "a", done: true, priority: 6 }),
      task({ id: "b", done: false, priority: 1 }),
      task({ id: "c", done: false, priority: 6 }),
    ];
    const sorted = [...tasks].sort(sortTasksForList);
    expect(sorted[0].id).toBe("c");
    expect(sorted[1].id).toBe("b");
    expect(sorted[2].id).toBe("a");
  });
});