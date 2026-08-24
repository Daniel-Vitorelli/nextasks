import { describe, expect, it } from "vitest";
import { parseConnectionInput, parseConnectionPatch } from "@/lib/validation/connections";
import { parseHabitInput, parseHabitPatch } from "@/lib/validation/habits";
import { parseRoutineInput } from "@/lib/validation/routines";
import { parseSubtaskInput, parseSubtaskPatch } from "@/lib/validation/subtasks";
import { parseTaskInput, parseTaskPatch } from "@/lib/validation/tasks";
import { parseTimeBlockInput, parseTimeBlockPatch } from "@/lib/validation/time-blocks";

describe("parseConnectionInput", () => {
  it("aceita conexão com task", () => {
    const input = parseConnectionInput({
      taskId: "t1",
      timeBlockId: "b1",
    });
    expect(input).toEqual({
      taskId: "t1",
      subtaskId: null,
      timeBlockId: "b1",
      requiredCount: 1,
      dayFilter: "all",
    });
  });

  it("aceita conexão com subtask", () => {
    const input = parseConnectionInput({
      subtaskId: "s1",
      timeBlockId: "b1",
      requiredCount: 3,
      dayFilter: "weekday:2",
    });
    expect(input).not.toBeNull();
    expect(input!.subtaskId).toBe("s1");
    expect(input!.requiredCount).toBe(3);
  });

  it("rejeita XOR violado (ambos ou nenhum)", () => {
    expect(parseConnectionInput({ taskId: "t1", subtaskId: "s1", timeBlockId: "b1" })).toBeNull();
    expect(parseConnectionInput({ timeBlockId: "b1" })).toBeNull();
  });

  it("rejeita requiredCount fora da faixa", () => {
    expect(parseConnectionInput({ taskId: "t1", timeBlockId: "b1", requiredCount: 0 })).toBeNull();
    expect(parseConnectionInput({ taskId: "t1", timeBlockId: "b1", requiredCount: 100 })).toBeNull();
  });

  it("rejeita dayFilter inválido (data impossível, weekday fora)", () => {
    expect(parseConnectionInput({ taskId: "t1", timeBlockId: "b1", dayFilter: "weekday:9" })).toBeNull();
    expect(parseConnectionInput({ taskId: "t1", timeBlockId: "b1", dayFilter: "date:2024-02-30" })).toBeNull();
    expect(parseConnectionInput({ taskId: "t1", timeBlockId: "b1", dayFilter: "date:2024-13-01" })).toBeNull();
  });
});

describe("parseConnectionPatch", () => {
  it("aceita patch parcial", () => {
    expect(parseConnectionPatch({ requiredCount: 2 })).toEqual({ requiredCount: 2 });
    expect(parseConnectionPatch({ dayFilter: "all" })).toEqual({ dayFilter: "all" });
  });

  it("rejeita patch vazio", () => {
    expect(parseConnectionPatch({})).toBeNull();
  });

  it("rejeita valor inválido", () => {
    expect(parseConnectionPatch({ requiredCount: 0 })).toBeNull();
  });
});

describe("parseTaskInput", () => {
  it("title obrigatório", () => {
    expect(parseTaskInput({})).toBeNull();
    expect(parseTaskInput({ title: "  " })).toBeNull();
  });

  it("priority inválida vira default 3", () => {
    expect(parseTaskInput({ title: "T", priority: 99 })!.priority).toBe(3);
    expect(parseTaskInput({ title: "T", priority: 5 })!.priority).toBe(5);
  });

  it("dueDate inválida vira null", () => {
    expect(parseTaskInput({ title: "T", dueDate: "nope" })!.dueDate).toBeNull();
    expect(parseTaskInput({ title: "T", dueDate: "2024-01-10" })!.dueDate).toEqual(new Date("2024-01-10T00:00:00.000Z"));
  });
});

describe("parseTaskPatch", () => {
  it("aceita done boolean", () => {
    expect(parseTaskPatch({ done: false })).toEqual({ done: false });
  });

  it("rejeita title vazio", () => {
    expect(parseTaskPatch({ title: " " })).toBeNull();
  });

  it("ignora campos de tipo errado", () => {
    expect(parseTaskPatch({ done: "yes" })).toEqual({});
  });
});

describe("parseSubtaskInput / Patch", () => {
  it("subtask requer title", () => {
    expect(parseSubtaskInput({})).toBeNull();
    expect(parseSubtaskInput({ title: "S" })).toEqual({ title: "S", description: null });
  });

  it("patch aceita done e title", () => {
    expect(parseSubtaskPatch({ done: true })).toEqual({ done: true });
    expect(parseSubtaskPatch({ title: "novo" })).toEqual({ title: "novo" });
  });
});

describe("parseRoutineInput", () => {
  it("requer nome", () => {
    expect(parseRoutineInput({})).toMatchObject({ ok: false });
  });

  it("frequência inválida vira daily", () => {
    const result = parseRoutineInput({ name: "R", frequency: "monthly" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.frequency).toBe("daily");
  });

  it("duração until exige endDate", () => {
    const result = parseRoutineInput({ name: "R", duration: "until", endDate: "2024-12-31" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.endDate).toEqual(new Date("2024-12-31T00:00:00.000Z"));
  });
});

describe("parseTimeBlockInput", () => {
  it("requer title, start e end válidos", () => {
    expect(parseTimeBlockInput({})).toBeNull();
    expect(parseTimeBlockInput({ title: "B", start: "x", end: "y" })).toBeNull();
  });

  it("rejeita fim antes do início (exceto all-day 00:00-00:00)", () => {
    expect(
      parseTimeBlockInput({
        title: "B",
        start: "2024-01-10T10:00:00.000Z",
        end: "2024-01-10T09:00:00.000Z",
      }),
    ).toBeNull();
    expect(
      parseTimeBlockInput({
        title: "B",
        start: "2024-01-10T00:00:00.000Z",
        end: "2024-01-10T00:00:00.000Z",
        isAllDay: true,
      }),
    ).not.toBeNull();
  });

  it("defaults de cor/confirmação", () => {
    const input = parseTimeBlockInput({
      title: "B",
      start: "2024-01-10T10:00:00.000Z",
      end: "2024-01-10T11:00:00.000Z",
    });
    expect(input!.color).toBe("green");
    expect(input!.confirmation).toBe("none");
  });
});

describe("parseTimeBlockPatch", () => {
  it("aceita patch parcial", () => {
    expect(parseTimeBlockPatch({ title: "novo" })).toEqual({ title: "novo" });
  });

  it("rejeita horário invertido quando ambos são enviados", () => {
    expect(
      parseTimeBlockPatch({
        start: "2024-01-10T11:00:00.000Z",
        end: "2024-01-10T10:00:00.000Z",
      }),
    ).toBeNull();
  });
});

describe("parseHabitInput", () => {
  it("hábito diário exige ao menos um dia", () => {
    const result = parseHabitInput({ name: "Correr", frequency: "daily", daysOfWeek: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/day of week/i);
    }
  });

  it("aceita diário com dias e serializa daysOfWeek", () => {
    const result = parseHabitInput({
      name: "  Correr  ",
      frequency: "daily",
      daysOfWeek: [1, 3],
      targetCount: 2,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.name).toBe("Correr");
      expect(result.data.daysOfWeek).toBe("[1,3]");
      expect(result.data.targetCount).toBe(2);
    }
  });

  it("semanal limpa os dias e aceita qualquer target", () => {
    const result = parseHabitInput({
      name: "Lavar roupa",
      frequency: "weekly",
      daysOfWeek: [1, 2, 3],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.daysOfWeek).toBe("[]");
      expect(result.data.targetCount).toBe(1);
    }
  });

  it("ícone inválido cai no default do catálogo", () => {
    const result = parseHabitInput({ name: "X", icon: "", daysOfWeek: [1] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.icon).toBe("CheckCircle2");
    }
  });
  it("targetCount abaixo de 1 cai no default", () => {
    const result = parseHabitInput({ name: "X", daysOfWeek: [1], targetCount: 0.5 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.targetCount).toBe(1);
    }
  });
});

describe("parseHabitPatch", () => {
  it("mudar para daily exige daysOfWeek não vazio", () => {
    expect(parseHabitPatch({ frequency: "daily" }).ok).toBe(false);
    expect(parseHabitPatch({ frequency: "daily", daysOfWeek: [] }).ok).toBe(false);
    expect(
      parseHabitPatch({ frequency: "daily", daysOfWeek: [1] }).ok,
    ).toBe(true);
  });

  it("não permite limpar os dias sem mudar a frequência", () => {
    const result = parseHabitPatch({ daysOfWeek: [] });
    expect(result.ok).toBe(false);
  });

  it("mudar para weekly descarta os dias enviados", () => {
    const toWeekly = parseHabitPatch({ frequency: "weekly", daysOfWeek: [1, 3] });
    expect(toWeekly.ok).toBe(true);
    if (toWeekly.ok) {
      expect(toWeekly.data.daysOfWeek).toBe("[]");
      expect(toWeekly.data.frequency).toBe("weekly");
    }
  });

  it("patch parcial ignora targetCount inválido", () => {
    const result = parseHabitPatch({ targetCount: 0.5 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.targetCount).toBeUndefined();
    }

    const valid = parseHabitPatch({ targetCount: 3 });
    expect(valid.ok).toBe(true);
    if (valid.ok) {
      expect(valid.data.targetCount).toBe(3);
    }
  });
});