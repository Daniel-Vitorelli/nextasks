import { beforeEach, describe, expect, it } from "vitest";
import { markSubtaskDoneCascade, markTaskDoneCascade } from "@/lib/server/subtask-cascade";
import {
  createSubtask,
  createTask,
  createUser,
  resetDb,
  testPrisma,
} from "./helpers";

describe("markTaskDoneCascade", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("marca a tarefa e todas as sub-tarefas pendentes", async () => {
    const user = await createUser();
    const task = await createTask(user.id);
    const a = await createSubtask(task.id, { title: "a" });
    const b = await createSubtask(task.id, { title: "b" });
    const b1 = await createSubtask(task.id, { title: "b1", parentId: b.id });
    await createSubtask(task.id, { title: "done", done: true });

    const result = await testPrisma().$transaction(async (tx) =>
      markTaskDoneCascade(tx, task.id),
    );

    const updated = await testPrisma().task.findUniqueOrThrow({ where: { id: task.id } });
    expect(updated.done).toBe(true);
    const undone = await testPrisma().subtask.findMany({
      where: { id: { in: [a.id, b.id, b1.id] } },
    });
    expect(undone.every((item) => item.done)).toBe(true);
    // Só os que transicionaram de pendente -> concluída.
    expect(result.completedSubtaskIds.sort()).toEqual([a.id, b.id, b1.id].sort());
    expect(result.taskCompleted).toBe(true);
  });

  it("não reporta transições quando a tarefa já estava feita", async () => {
    const user = await createUser();
    const task = await createTask(user.id, { done: true });
    const result = await testPrisma().$transaction(async (tx) =>
      markTaskDoneCascade(tx, task.id),
    );
    expect(result.taskCompleted).toBe(false);
    expect(result.completedSubtaskIds).toEqual([]);
  });
});

describe("markSubtaskDoneCascade", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("marca a sub-árvore, sobe ancestrais e conclui a tarefa quando todas as raízes estão feitas", async () => {
    const user = await createUser();
    const task = await createTask(user.id);
    const root = await createSubtask(task.id, { title: "root" });
    const child = await createSubtask(task.id, { title: "child", parentId: root.id });
    const grandchild = await createSubtask(task.id, { title: "gc", parentId: child.id });
    await createSubtask(task.id, { title: "sibling", done: true });

    // Simula a rota: grava done:true no nó e informa o estado anterior.
    await testPrisma().subtask.update({ where: { id: root.id }, data: { done: true } });
    const result = await testPrisma().$transaction(async (tx) =>
      markSubtaskDoneCascade(tx, task.id, root.id, false),
    );

    const all = await testPrisma().subtask.findMany({ where: { taskId: task.id } });
    expect(all.every((item) => item.done)).toBe(true);
    const taskAfter = await testPrisma().task.findUniqueOrThrow({ where: { id: task.id } });
    expect(taskAfter.done).toBe(true);
    expect(result.completedTask).toBe(true);
    expect(result.completedSubtaskIds.sort()).toEqual([root.id, child.id, grandchild.id].sort());
  });

  it("não conclui a tarefa quando sobra raiz pendente", async () => {
    const user = await createUser();
    const task = await createTask(user.id);
    const root = await createSubtask(task.id, { title: "root" });
    await createSubtask(task.id, { title: "pendente" });

    await testPrisma().subtask.update({ where: { id: root.id }, data: { done: true } });
    const result = await testPrisma().$transaction(async (tx) =>
      markSubtaskDoneCascade(tx, task.id, root.id, false),
    );

    const taskAfter = await testPrisma().task.findUniqueOrThrow({ where: { id: task.id } });
    expect(taskAfter.done).toBe(false);
    expect(result.completedTask).toBe(false);
    expect(result.completedSubtaskIds).toEqual([root.id]);
  });

  it("não reporta nós já concluídos como transicionados", async () => {
    const user = await createUser();
    const task = await createTask(user.id, { done: true });
    const root = await createSubtask(task.id, { title: "root", done: true });
    await createSubtask(task.id, { title: "child", parentId: root.id, done: true });

    const result = await testPrisma().$transaction(async (tx) =>
      markSubtaskDoneCascade(tx, task.id, root.id, true),
    );

    expect(result.completedSubtaskIds).toEqual([]);
    expect(result.completedTask).toBe(false);
  });

  it("sobe a cadeia apenas enquanto todos os filhos estiverem feitos", async () => {
    const user = await createUser();
    const task = await createTask(user.id);
    const root = await createSubtask(task.id, { title: "root" });
    const child = await createSubtask(task.id, { title: "child", parentId: root.id });
    await createSubtask(task.id, { title: "sibling", parentId: root.id });

    await testPrisma().subtask.update({ where: { id: child.id }, data: { done: true } });
    const result = await testPrisma().$transaction(async (tx) =>
      markSubtaskDoneCascade(tx, task.id, child.id, false),
    );

    const rootAfter = await testPrisma().subtask.findUniqueOrThrow({ where: { id: root.id } });
    expect(rootAfter.done).toBe(false);
    expect(result.completedTask).toBe(false);
  });
});