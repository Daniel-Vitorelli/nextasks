import { beforeEach, describe, expect, it } from "vitest";

import type { DataExport } from "@/types/domain";
import { parseDataExport } from "@/lib/validation/data-transfer";
import { parseUserPatch } from "@/lib/validation/user";
import {
  buildDataExport,
  importDataExport,
} from "@/lib/server/data-transfer";
import {
  createBlock,
  createCompletion,
  createConnection,
  createHabit,
  createHabitCompletion,
  createRoutine,
  createSubtask,
  createTask,
  createUser,
  resetDb,
  testPrisma,
} from "./helpers";

describe("parseUserPatch", () => {
  it("aceita nome com trim", () => {
    expect(parseUserPatch({ name: "  Ana  " })).toEqual({ name: "Ana" });
  });

  it("rejeita nome vazio, longo ou não-string", () => {
    expect(parseUserPatch({ name: "   " })).toBeNull();
    expect(parseUserPatch({ name: "x".repeat(51) })).toBeNull();
    expect(parseUserPatch({ name: 42 })).toBeNull();
  });

  it("aceita timezoneOffset inteiro e null (automático)", () => {
    expect(parseUserPatch({ timezoneOffset: 180 })).toEqual({
      timezoneOffset: 180,
    });
    expect(parseUserPatch({ timezoneOffset: null })).toEqual({
      timezoneOffset: null,
    });
    expect(parseUserPatch({ timezoneOffset: -120 })).toEqual({
      timezoneOffset: -120,
    });
  });

  it("rejeita timezoneOffset não-inteiro ou fora do intervalo", () => {
    expect(parseUserPatch({ timezoneOffset: 60.5 })).toBeNull();
    expect(parseUserPatch({ timezoneOffset: -721 })).toBeNull();
    expect(parseUserPatch({ timezoneOffset: 841 })).toBeNull();
    expect(parseUserPatch({ timezoneOffset: "180" })).toBeNull();
  });

  it("aceita image PNG data URL e null (remover foto)", () => {
    const dataUrl = "data:image/png;base64,iVBORw0KGgo=";
    expect(parseUserPatch({ image: dataUrl })).toEqual({ image: dataUrl });
    expect(parseUserPatch({ image: null })).toEqual({ image: null });
  });

  it("rejeita image inválida", () => {
    expect(parseUserPatch({ image: "" })).toBeNull();
    expect(parseUserPatch({ image: 42 })).toBeNull();
    expect(parseUserPatch({ image: "https://example.com/a.png" })).toBeNull();
    expect(
      parseUserPatch({ image: "data:image/jpeg;base64,aGVsbG8=" }),
    ).toBeNull();
    expect(
      parseUserPatch({ image: "data:image/png;base64,not valid!" }),
    ).toBeNull();
    expect(parseUserPatch({ image: "x".repeat(1536 * 1024 + 1) })).toBeNull();
  });

  it("rejeita payload vazio", () => {
    expect(parseUserPatch({})).toBeNull();
    expect(parseUserPatch(null)).toBeNull();
  });
});

function minimalExport(): DataExport {
  return {
    version: 1,
    exportedAt: "2024-01-10T00:00:00.000Z",
    routines: [
      {
        id: "r1",
        name: "Rotina",
        description: null,
        frequency: "daily",
        duration: "indefinite",
        endDate: null,
        isActive: true,
        createdAt: "2024-01-01T00:00:00.000Z",
      },
    ],
    timeBlocks: [
      {
        id: "b1",
        routineId: "r1",
        title: "Bloco",
        description: null,
        start: "2024-01-01T10:00:00.000Z",
        end: "2024-01-01T11:00:00.000Z",
        isAllDay: false,
        color: "green",
        confirmation: "checklist",
      },
    ],
    tasks: [
      {
        id: "t1",
        title: "Tarefa",
        description: null,
        dueDate: null,
        priority: 3,
        done: false,
        createdAt: "2024-01-01T00:00:00.000Z",
      },
    ],
    subtasks: [],
    connections: [
      {
        taskId: "t1",
        subtaskId: null,
        habitId: null,
        timeBlockId: "b1",
        requiredCount: 2,
        dayFilter: "weekday:3",
        createdAt: "2024-01-01T00:00:00.000Z",
      },
    ],
    completions: [
      {
        timeBlockId: "b1",
        periodStart: "2024-01-03T00:00:00.000Z",
        periodEnd: "2024-01-04T00:00:00.000Z",
        value: "true",
        source: "explicit",
        sourceEntityId: null,
        updatedAt: "2024-01-03T00:00:00.000Z",
      },
    ],
    habits: [],
    habitCompletions: [],
  };
}

describe("parseDataExport", () => {
  it("aceita payload mínimo válido", () => {
    expect(parseDataExport(minimalExport())).not.toBeNull();
  });

  it("rejeita versão desconhecida ou arrays ausentes", () => {
    expect(parseDataExport({ ...minimalExport(), version: 2 })).toBeNull();
    const missing = minimalExport();
    delete (missing as { routines?: unknown }).routines;
    expect(parseDataExport(missing)).toBeNull();
  });

  it("rejeita referências a entidades ausentes", () => {
    const unknownTask = minimalExport();
    unknownTask.subtasks = [
      {
        id: "s1",
        taskId: "nao-existe",
        parentId: null,
        title: "Sub",
        description: null,
        done: false,
        createdAt: "2024-01-01T00:00:00.000Z",
      },
    ];
    expect(parseDataExport(unknownTask)).toBeNull();

    const unknownBlock = minimalExport();
    unknownBlock.completions[0].timeBlockId = "nao-existe";
    expect(parseDataExport(unknownBlock)).toBeNull();

    const unknownEntity = minimalExport();
    unknownEntity.connections[0].taskId = "nao-existe";
    expect(parseDataExport(unknownEntity)).toBeNull();
  });

  it("rejeita parentId ausente ou auto-referente", () => {
    const selfRef = minimalExport();
    selfRef.subtasks = [
      {
        id: "s1",
        taskId: "t1",
        parentId: "s1",
        title: "Sub",
        description: null,
        done: false,
        createdAt: "2024-01-01T00:00:00.000Z",
      },
    ];
    expect(parseDataExport(selfRef)).toBeNull();

    const missingParent = minimalExport();
    missingParent.subtasks = [
      {
        id: "s1",
        taskId: "t1",
        parentId: "s2",
        title: "Sub",
        description: null,
        done: false,
        createdAt: "2024-01-01T00:00:00.000Z",
      },
    ];
    expect(parseDataExport(missingParent)).toBeNull();
  });

  it("rejeita conexão sem XOR (ambos ou nenhum)", () => {
    const both = minimalExport();
    both.connections[0] = {
      ...both.connections[0],
      taskId: "t1",
      subtaskId: "s1",
    };
    expect(parseDataExport(both)).toBeNull();

    const none = minimalExport();
    none.connections[0] = { ...none.connections[0], taskId: null };
    expect(parseDataExport(none)).toBeNull();
  });

  it("normaliza cor/prioridade inválidas em vez de rejeitar", () => {
    const dirty: unknown = {
      ...minimalExport(),
      timeBlocks: [{ ...minimalExport().timeBlocks[0], color: "neon" }],
      tasks: [{ ...minimalExport().tasks[0], priority: 99 }],
    };
    const parsed = parseDataExport(dirty);
    expect(parsed).not.toBeNull();
    expect(parsed!.timeBlocks[0].color).toBe("green");
    expect(parsed!.tasks[0].priority).toBe(3);
  });

  it("aceita backups antigos sem hábitos e valida referências novas", () => {
    const legacy = minimalExport();
    delete (legacy as { habits?: unknown }).habits;
    delete (legacy as { habitCompletions?: unknown }).habitCompletions;
    expect(parseDataExport(legacy)).not.toBeNull();

    const withHabits = {
      ...minimalExport(),
      habits: [
        {
          id: "h1",
          name: "Beber água",
          description: null,
          icon: "CheckCircle2",
          color: "blue",
          type: "good",
          frequency: "daily",
          daysOfWeek: "[1,3]",
          targetCount: 2,
        },
      ],
      habitCompletions: [
        { habitId: "h1", date: "2024-01-10T00:00:00.000Z", count: 1 },
      ],
    };
    const parsed = parseDataExport(withHabits);
    expect(parsed).not.toBeNull();
    expect(parsed!.habits).toHaveLength(1);
    expect(parsed!.habits[0].daysOfWeek).toBe("[1,3]");

    // Backup antigo sem type vira "good" (comportamento legado).
    const legacyType = parseDataExport({
      ...withHabits,
      habits: [{ ...withHabits.habits[0], type: undefined }],
    });
    expect(legacyType!.habits[0].type).toBe("good");

    // Conclusão apontando para hábito inexistente é rejeitada.
    const orphan = {
      ...withHabits,
      habitCompletions: [
        { habitId: "nao-existe", date: "2024-01-10T00:00:00.000Z", count: 1 },
      ],
    };
    expect(parseDataExport(orphan)).toBeNull();

    // Conexão hábito↔bloco válida no backup.
    const withHabitConnection = parseDataExport({
      ...withHabits,
      connections: [
        ...minimalExport().connections,
        {
          taskId: null,
          subtaskId: null,
          habitId: "h1",
          timeBlockId: "b1",
          requiredCount: 1,
          dayFilter: "all",
          createdAt: "2024-01-01T00:00:00.000Z",
        },
      ],
    });
    expect(withHabitConnection).not.toBeNull();
    expect(withHabitConnection!.connections).toHaveLength(2);
    expect(withHabitConnection!.connections[1].habitId).toBe("h1");

    // Conexão apontando para hábito inexistente é rejeitada.
    const unknownHabitConnection = parseDataExport({
      ...withHabits,
      connections: [
        {
          taskId: null,
          subtaskId: null,
          habitId: "nao-existe",
          timeBlockId: "b1",
          requiredCount: 1,
          dayFilter: "all",
          createdAt: "2024-01-01T00:00:00.000Z",
        },
      ],
    });
    expect(unknownHabitConnection).toBeNull();

    // Hábito sem nome é rejeitado.
    const unnamed = {
      ...withHabits,
      habits: [{ ...withHabits.habits[0], name: "   " }],
    };
    expect(parseDataExport(unnamed)).toBeNull();
  });
});

describe("export/import round-trip", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("replica fielmente o conjunto de dados para outro usuário", async () => {
    const source = await createUser({ name: "Origem" });
    const routine = await createRoutine(source.id, { name: "Minha rotina" });
    const block = await createBlock(routine.id, {
      title: "Estudar",
      confirmation: "score",
    });
    const task = await createTask(source.id, { title: "Projeto", done: true });
    const parent = await createSubtask(task.id, { title: "Raiz", done: true });
    const child = await createSubtask(task.id, {
      title: "Filho",
      parentId: parent.id,
    });
    await createConnection(
      source.id,
      block.id,
      { taskId: task.id },
      { requiredCount: 3, dayFilter: "weekday:2" },
    );
    const period = new Date("2024-01-10T00:00:00.000Z");
    await createCompletion(source.id, block.id, period, "9", {
      source: "auto",
      sourceEntityId: `subtask:${child.id}`,
    });
    const habit = await createHabit(source.id, { targetCount: 2 });
    await createHabitCompletion(
      source.id,
      habit.id,
      new Date("2024-01-10T00:00:00.000Z"),
      2,
    );

    const exported = await buildDataExport(source.id);
    expect(parseDataExport(exported)).not.toBeNull();
    expect(exported.routines).toHaveLength(1);
    expect(exported.subtasks).toHaveLength(2);
    expect(exported.connections).toHaveLength(1);
    expect(exported.completions).toHaveLength(1);
    expect(exported.habits).toHaveLength(1);

    const target = await createUser({ name: "Destino" });
    const result = await importDataExport(target.id, exported);
    expect(result).toEqual({
      routines: 1,
      timeBlocks: 1,
      tasks: 1,
      subtasks: 2,
      connections: 1,
      completions: 1,
      habits: 1,
      habitCompletions: 1,
    });

    const prisma = testPrisma();
    const routines = await prisma.routine.findMany({ where: { userId: target.id } });
    expect(routines).toHaveLength(1);
    expect(routines[0].name).toBe("Minha rotina");

    const blocks = await prisma.timeBlock.findMany({
      where: { routineId: routines[0].id },
    });
    expect(blocks).toHaveLength(1);
    expect(blocks[0].title).toBe("Estudar");

    const tasks = await prisma.task.findMany({ where: { userId: target.id } });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].done).toBe(true);

    const subtasks = await prisma.subtask.findMany({
      where: { taskId: tasks[0].id },
      orderBy: { createdAt: "asc" },
    });
    expect(subtasks).toHaveLength(2);
    const [importedParent, importedChild] = subtasks;
    expect(importedParent.parentId).toBeNull();
    expect(importedChild.parentId).toBe(importedParent.id);

    const connections = await prisma.taskBlockConnection.findMany({
      where: { userId: target.id },
    });
    expect(connections).toHaveLength(1);
    expect(connections[0].taskId).toBe(tasks[0].id);
    expect(connections[0].timeBlockId).toBe(blocks[0].id);
    expect(connections[0].requiredCount).toBe(3);

    const completions = await prisma.timeBlockCompletion.findMany({
      where: { userId: target.id },
    });
    expect(completions).toHaveLength(1);
    expect(completions[0].timeBlockId).toBe(blocks[0].id);
    expect(completions[0].periodStart.toISOString()).toBe(period.toISOString());
    expect(completions[0].value).toBe("9");
    expect(completions[0].source).toBe("auto");
    expect(completions[0].sourceEntityId).toBe(`subtask:${importedChild.id}`);

    const habits = await prisma.habit.findMany({ where: { userId: target.id } });
    expect(habits).toHaveLength(1);
    expect(habits[0].name).toBe("Beber água");
    expect(habits[0].targetCount).toBe(2);

    const habitCompletions = await prisma.habitCompletion.findMany({
      where: { userId: target.id },
    });
    expect(habitCompletions).toHaveLength(1);
    expect(habitCompletions[0].habitId).toBe(habits[0].id);
    expect(habitCompletions[0].count).toBe(2);

    // Nenhum id do arquivo original é reutilizado.
    expect(routines[0].id).not.toBe(exported.routines[0].id);
    expect(tasks[0].id).not.toBe(exported.tasks[0].id);
  });

  it("preserva timestamps de conexões e confirmações", async () => {
    const source = await createUser();
    const routine = await createRoutine(source.id);
    const block = await createBlock(routine.id);
    const task = await createTask(source.id);

    const oldCreatedAt = new Date("2024-01-01T00:00:00.000Z");
    await createConnection(source.id, block.id, { taskId: task.id }, {
      createdAt: oldCreatedAt,
    });
    const period = new Date("2024-01-02T00:00:00.000Z");
    await createCompletion(source.id, block.id, period, "true", {
      updatedAt: new Date("2024-01-03T00:00:00.000Z"),
    });

    const exported = await buildDataExport(source.id);
    const target = await createUser();
    await importDataExport(target.id, exported);

    const prisma = testPrisma();
    const connection = await prisma.taskBlockConnection.findFirst({
      where: { userId: target.id },
    });
    expect(connection?.createdAt.toISOString()).toBe(
      oldCreatedAt.toISOString(),
    );

    const completion = await prisma.timeBlockCompletion.findFirst({
      where: { userId: target.id },
    });
    expect(completion?.updatedAt.toISOString()).toBe(
      "2024-01-03T00:00:00.000Z",
    );
  });
});
