import { beforeEach, describe, expect, it } from "vitest";
import {
  completeEntitiesForBlock,
  confirmBlocksForDoneEntities,
  connectionInclude,
  countBeforeConnection,
  countConfirmed,
  isDayFilterSatisfiable,
  isRequiredCountReachable,
  loadCompletionsByBlock,
  reversePropagateForBlock,
  reversePropagateForEntities,
  toConnectionRow,
} from "@/lib/server/connections";
import { markTaskDoneCascade } from "@/lib/server/subtask-cascade";
import { periodForFrequency } from "@/lib/server/completions";
import {
  createBlock,
  createCompletion,
  createConnection,
  createRoutine,
  createTask,
  createUser,
  resetDb,
  testPrisma,
} from "./helpers";

const TZ = 0;
const NOW = new Date("2024-01-10T12:00:00.000Z");

// Bloco padrão dos testes de propagação: começa às 09:00 e termina às 10:00
// do dia de NOW. Usar Date.now() (padrão do helper) deixava o horário do
// bloco dependente da hora em que a suíte roda (falhas após as 14:00 UTC).
const BLOCK_START = new Date("2024-01-10T09:00:00.000Z");
const BLOCK_END = new Date("2024-01-10T10:00:00.000Z");

function pastBlock(
  routineId: string,
  overrides: Parameters<typeof createBlock>[1] = {},
) {
  return createBlock(routineId, { start: BLOCK_START, end: BLOCK_END, ...overrides });
}

describe("helpers puros", () => {
  it("isDayFilterSatisfiable: bloco semanal só aceita o próprio dia", () => {
    expect(isDayFilterSatisfiable("weekday:3", "weekly", 3)).toBe(true);
    expect(isDayFilterSatisfiable("weekday:4", "weekly", 3)).toBe(false);
    // Bloco diário aceita qualquer filtro.
    expect(isDayFilterSatisfiable("weekday:4", "daily", 3)).toBe(true);
  });

  it("isDayFilterSatisfiable: data específica usa o dia local, sem depender do fuso", () => {
    // 2026-08-20 é uma quinta-feira local (o fuso do usuário não muda o dia
    // nominal da data; antes o offset deslocava o cálculo em um dia para
    // fusos a oeste de UTC e rejeitava filtros válidos).
    expect(isDayFilterSatisfiable("date:2026-08-20", "weekly", 4)).toBe(true);
    expect(isDayFilterSatisfiable("date:2026-08-20", "weekly", 3)).toBe(false);
    expect(isDayFilterSatisfiable("date:2026-08-20", "daily", 4)).toBe(true);
    expect(isDayFilterSatisfiable("date:2026-08-19", "weekly", 3)).toBe(true);
  });

  it("isRequiredCountReachable: filtro date só permite 1", () => {
    expect(isRequiredCountReachable(1, "date:2024-01-10")).toBe(true);
    expect(isRequiredCountReachable(2, "date:2024-01-10")).toBe(false);
    expect(isRequiredCountReachable(99, "all")).toBe(true);
  });
});

describe("countConfirmed / countBeforeConnection", () => {
  beforeEach(async () => {
    await resetDb();
  });

  

  it("conta apenas confirmações a partir da criação da conexão, filtradas pelo dia", async () => {
    const user = await createUser();
    const routine = await createRoutine(user.id);
    const block = await pastBlock(routine.id, { confirmation: "checklist" });
    const taskA = await createTask(user.id, { title: "A" });
    const taskB = await createTask(user.id, { title: "B" });

    // Conexão A antiga (10 dias) e conexão B nova (5 dias) no mesmo bloco.
    const connA = await createConnection(user.id, block.id, { taskId: taskA.id }, {
      createdAt: new Date(NOW.getTime() - 10 * 86_400_000),
    });
    const connB = await createConnection(user.id, block.id, { taskId: taskB.id }, {
      createdAt: new Date(NOW.getTime() - 5 * 86_400_000),
    });

    // Duas confirmações depois de B, uma entre A e B, e uma antes de A.
    const day1 = periodForFrequency("daily", new Date("2024-01-08T00:00:00.000Z"), TZ).start;
    const day2 = periodForFrequency("daily", new Date("2024-01-09T00:00:00.000Z"), TZ).start;
    const day3 = periodForFrequency("daily", new Date("2024-01-06T00:00:00.000Z"), TZ).start;
    const day4 = periodForFrequency("daily", new Date("2024-01-01T00:00:00.000Z"), TZ).start;

    await createCompletion(user.id, block.id, day1, "true", { updatedAt: new Date(NOW) });
    await createCompletion(user.id, block.id, day2, "true", { updatedAt: new Date(NOW) });
    await createCompletion(user.id, block.id, day3, "true", {
      updatedAt: new Date(NOW.getTime() - 6 * 86_400_000), // entre A e B
    });
    await createCompletion(user.id, block.id, day4, "true", {
      updatedAt: new Date(NOW.getTime() - 20 * 86_400_000), // antes de A: nem carrega
    });

    const completions = [...(await loadCompletionsByBlock(testPrisma(), [connA, connB])).get(block.id)!];
    const loadedA = await testPrisma().taskBlockConnection.findFirstOrThrow({
      where: { id: connA.id },
      include: connectionInclude,
    });
    const loadedB = await testPrisma().taskBlockConnection.findFirstOrThrow({
      where: { id: connB.id },
      include: connectionInclude,
    });

    // A: as 3 confirmações carregadas (>= createdAt de A) contam.
    expect(countConfirmed(loadedA, completions, TZ)).toBe(3);
    expect(countBeforeConnection(loadedA, completions, TZ)).toBe(0);
    // B: só as 2 posteriores a B; a de 6 dias atrás aparece como "antes".
    expect(countConfirmed(loadedB, completions, TZ)).toBe(2);
    expect(countBeforeConnection(loadedB, completions, TZ)).toBe(1);
  });

  it("checklist só conta \"true\" e score conta qualquer nota >= 1", async () => {
    const user = await createUser();
    const routine = await createRoutine(user.id);
    const checklist = await pastBlock(routine.id, { confirmation: "checklist" });
    const score = await pastBlock(routine.id, { confirmation: "score", title: "Score" });
    const task = await createTask(user.id);
    const today = periodForFrequency("daily", NOW, TZ).start;

    const cCheck = await createConnection(user.id, checklist.id, { taskId: task.id }, {
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
    });
    const cScore = await createConnection(user.id, score.id, { taskId: task.id }, {
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
    });

    await createCompletion(user.id, checklist.id, today, "false");
    await createCompletion(user.id, score.id, today, "7");

    const check = await testPrisma().taskBlockConnection.findFirstOrThrow({
      where: { id: cCheck.id },
      include: connectionInclude,
    });
    const sc = await testPrisma().taskBlockConnection.findFirstOrThrow({
      where: { id: cScore.id },
      include: connectionInclude,
    });

    expect(countConfirmed(check, [{ periodStart: today, value: "false", updatedAt: NOW }], TZ)).toBe(0);
    expect(countConfirmed(sc, [{ periodStart: today, value: "7", updatedAt: NOW }], TZ)).toBe(1);
  });
});

describe("propagação direta (bloco -> entidade)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  

  it("bloco confirmado completa a tarefa quando todas as conexões estão satisfeitas", async () => {
    const user = await createUser();
    const routine = await createRoutine(user.id);
    const block = await pastBlock(routine.id, { confirmation: "checklist" });
    const task = await createTask(user.id);
    await createConnection(user.id, block.id, { taskId: task.id });

    const period = periodForFrequency("daily", NOW, TZ);
    await createCompletion(user.id, block.id, period.start, "true");

    await testPrisma().$transaction(async (tx) =>
      completeEntitiesForBlock(tx, user.id, block.id, TZ, NOW),
    );

    const after = await testPrisma().task.findUniqueOrThrow({ where: { id: task.id } });
    expect(after.done).toBe(true);
  });

  it("não completa com requiredCount insatisfeito", async () => {
    const user = await createUser();
    const routine = await createRoutine(user.id);
    const block = await pastBlock(routine.id, { confirmation: "checklist" });
    const task = await createTask(user.id);
    await createConnection(user.id, block.id, { taskId: task.id }, { requiredCount: 2 });

    const period = periodForFrequency("daily", NOW, TZ);
    await createCompletion(user.id, block.id, period.start, "true");

    await testPrisma().$transaction(async (tx) =>
      completeEntitiesForBlock(tx, user.id, block.id, TZ, NOW),
    );

    const after = await testPrisma().task.findUniqueOrThrow({ where: { id: task.id } });
    expect(after.done).toBe(false);
  });

  it("entidade só completa quando TODAS as conexões estão satisfeitas", async () => {
    const user = await createUser();
    const routine = await createRoutine(user.id);
    const blockA = await pastBlock(routine.id, { confirmation: "checklist" });
    const blockB = await pastBlock(routine.id, { confirmation: "checklist", title: "B" });
    const task = await createTask(user.id);
    await createConnection(user.id, blockA.id, { taskId: task.id });
    await createConnection(user.id, blockB.id, { taskId: task.id });

    const period = periodForFrequency("daily", NOW, TZ);
    await createCompletion(user.id, blockA.id, period.start, "true");

    await testPrisma().$transaction(async (tx) =>
      completeEntitiesForBlock(tx, user.id, blockA.id, TZ, NOW),
    );

    const after = await testPrisma().task.findUniqueOrThrow({ where: { id: task.id } });
    expect(after.done).toBe(false);

    await createCompletion(user.id, blockB.id, period.start, "true");
    await testPrisma().$transaction(async (tx) =>
      completeEntitiesForBlock(tx, user.id, blockB.id, TZ, NOW),
    );
    const after2 = await testPrisma().task.findUniqueOrThrow({ where: { id: task.id } });
    expect(after2.done).toBe(true);
  });

  it("concluir a tarefa (rota) auto-confirma os blocos conectados (checklist=true, score=10)", async () => {
    const user = await createUser();
    const routine = await createRoutine(user.id);
    const blockA = await pastBlock(routine.id, { confirmation: "checklist" });
    const blockB = await pastBlock(routine.id, { confirmation: "score", title: "B" });
    const task = await createTask(user.id);
    await createConnection(user.id, blockA.id, { taskId: task.id });
    await createConnection(user.id, blockB.id, { taskId: task.id });

    const period = periodForFrequency("daily", NOW, TZ);
    // Confirmar só o bloco A não completa a tarefa: a conexão com B também
    // precisa estar satisfeita (regra "todas as conexões").
    await createCompletion(user.id, blockA.id, period.start, "true");
    await testPrisma().$transaction(async (tx) =>
      completeEntitiesForBlock(tx, user.id, blockA.id, TZ, NOW),
    );
    expect((await testPrisma().task.findUniqueOrThrow({ where: { id: task.id } })).done).toBe(false);

    // Simula a rota da tarefa: usuário marca a tarefa como feita e a cascata
    // detecta a transição (wasDone=false), auto-confirmando os blocos.
    await testPrisma().$transaction(async (tx) => {
      await tx.task.update({ where: { id: task.id }, data: { done: true } });
      const { completedSubtaskIds, taskCompleted } = await markTaskDoneCascade(tx, task.id, false);
      await confirmBlocksForDoneEntities(tx, taskCompleted ? [task.id] : [], completedSubtaskIds, TZ, NOW);
    });

    const bCompletions = await testPrisma().timeBlockCompletion.findMany({
      where: { timeBlockId: blockB.id },
    });
    expect(bCompletions).toHaveLength(1);
    expect(bCompletions[0].value).toBe("10");
    expect(bCompletions[0].source).toBe("auto");
    expect(bCompletions[0].sourceEntityId).toBe(`task:${task.id}`);
  });

  it("auto-confirmação é idempotente (upsert não duplica)", async () => {
    const user = await createUser();
    const routine = await createRoutine(user.id);
    const blockA = await pastBlock(routine.id, { confirmation: "checklist" });
    const blockB = await pastBlock(routine.id, { confirmation: "checklist", title: "B" });
    const task = await createTask(user.id);
    await createConnection(user.id, blockA.id, { taskId: task.id });
    await createConnection(user.id, blockB.id, { taskId: task.id });

    const period = periodForFrequency("daily", NOW, TZ);
    await createCompletion(user.id, blockA.id, period.start, "true");

    await testPrisma().$transaction(async (tx) =>
      completeEntitiesForBlock(tx, user.id, blockA.id, TZ, NOW),
    );
    await testPrisma().$transaction(async (tx) =>
      confirmBlocksForDoneEntities(tx, [task.id], [], TZ, NOW),
    );

    const bCompletions = await testPrisma().timeBlockCompletion.findMany({
      where: { timeBlockId: blockB.id },
    });
    expect(bCompletions).toHaveLength(1);
  });

  it("decisão explícita do usuário nunca é sobrescrita pela auto-confirmação", async () => {
    const user = await createUser();
    const routine = await createRoutine(user.id);
    const blockA = await pastBlock(routine.id, { confirmation: "checklist" });
    const blockB = await pastBlock(routine.id, { confirmation: "checklist", title: "B" });
    const task = await createTask(user.id);
    await createConnection(user.id, blockA.id, { taskId: task.id });
    await createConnection(user.id, blockB.id, { taskId: task.id });

    const period = periodForFrequency("daily", NOW, TZ);
    // Usuário desmarcou o bloco B hoje (explícito).
    await createCompletion(user.id, blockB.id, period.start, "false");
    await createCompletion(user.id, blockA.id, period.start, "true");

    await testPrisma().$transaction(async (tx) =>
      completeEntitiesForBlock(tx, user.id, blockA.id, TZ, NOW),
    );

    const bCompletions = await testPrisma().timeBlockCompletion.findMany({
      where: { timeBlockId: blockB.id },
    });
    expect(bCompletions).toHaveLength(1);
    expect(bCompletions[0].value).toBe("false");
    expect(bCompletions[0].source).toBe("explicit");
  });

  it("não auto-confirma bloco que ainda não começou no período", async () => {
    const user = await createUser();
    const routine = await createRoutine(user.id);
    const blockA = await pastBlock(routine.id, { confirmation: "checklist" });
    const future = new Date(NOW.getTime() + 2 * 60 * 60 * 1000);
    const blockB = await pastBlock(routine.id, { confirmation: "checklist", title: "B", start: future });
    const task = await createTask(user.id);
    await createConnection(user.id, blockA.id, { taskId: task.id });
    await createConnection(user.id, blockB.id, { taskId: task.id });

    const period = periodForFrequency("daily", NOW, TZ);
    await createCompletion(user.id, blockA.id, period.start, "true");

    await testPrisma().$transaction(async (tx) =>
      completeEntitiesForBlock(tx, user.id, blockA.id, TZ, NOW),
    );

    const bCompletions = await testPrisma().timeBlockCompletion.findMany({
      where: { timeBlockId: blockB.id },
    });
    expect(bCompletions).toHaveLength(0);
  });

  it("auto-confirmação respeita o dayFilter (semanal: só o dia do bloco)", async () => {
    const user = await createUser();
    const routine = await createRoutine(user.id, { frequency: "weekly" });
    // 2024-01-10 é quarta (3): bloco semanal ocorre às quartas.
    const block = await pastBlock(routine.id, { confirmation: "checklist" });
    const task = await createTask(user.id);
    // Conexão pede segundas (1): a semana atual não casa.
    const connection = await createConnection(user.id, block.id, { taskId: task.id }, { dayFilter: "weekday:1" });

    await testPrisma().$transaction(async (tx) =>
      confirmBlocksForDoneEntities(tx, [task.id], [], TZ, NOW),
    );

    const completions = await testPrisma().timeBlockCompletion.findMany({
      where: { timeBlockId: block.id },
    });
    expect(completions).toHaveLength(0);

    // Conexão no dia certo (quarta = 3) passa a auto-confirmar.
    await testPrisma().taskBlockConnection.update({
      where: { id: connection.id },
      data: { dayFilter: "weekday:3" },
    });
    await testPrisma().$transaction(async (tx) =>
      confirmBlocksForDoneEntities(tx, [task.id], [], TZ, NOW),
    );
    const completions2 = await testPrisma().timeBlockCompletion.findMany({
      where: { timeBlockId: block.id },
    });
    expect(completions2).toHaveLength(1);
  });

  it("toConnectionRow expõe confirmedCount e countedBefore", async () => {
    const user = await createUser();
    const routine = await createRoutine(user.id);
    const block = await pastBlock(routine.id, { confirmation: "checklist" });
    const task = await createTask(user.id);
    const connection = await createConnection(user.id, block.id, { taskId: task.id }, {
      createdAt: new Date(NOW.getTime() - 5 * 86_400_000),
    });
    const period = periodForFrequency("daily", NOW, TZ);
    await createCompletion(user.id, block.id, period.start, "true");

    const loaded = await testPrisma().taskBlockConnection.findFirstOrThrow({
      where: { id: connection.id },
      include: connectionInclude,
    });
    const completions = [...(await loadCompletionsByBlock(testPrisma(), [loaded])).get(block.id)!];

    const row = toConnectionRow(loaded, completions, TZ);
    expect(row.confirmedCount).toBe(1);
    expect(row.countedBefore).toBe(0);
    expect(row.requiredCount).toBe(1);
  });
});

describe("propagação reversa", () => {
  beforeEach(async () => {
    await resetDb();
  });

  

  it("desmarcar um bloco reabre a entidade que dependia dele", async () => {
    const user = await createUser();
    const routine = await createRoutine(user.id);
    const block = await pastBlock(routine.id, { confirmation: "checklist" });
    const task = await createTask(user.id);
    await createConnection(user.id, block.id, { taskId: task.id });

    const period = periodForFrequency("daily", NOW, TZ);
    await createCompletion(user.id, block.id, period.start, "true");
    await testPrisma().$transaction(async (tx) =>
      completeEntitiesForBlock(tx, user.id, block.id, TZ, NOW),
    );
    expect((await testPrisma().task.findUniqueOrThrow({ where: { id: task.id } })).done).toBe(true);

    // Simula o PATCH da rota: usuário desmarca -> upsert value "false" + reverse.
    await testPrisma().timeBlockCompletion.upsert({
      where: { timeBlockId_periodStart: { timeBlockId: block.id, periodStart: period.start } },
      create: {
        timeBlockId: block.id,
        userId: user.id,
        periodStart: period.start,
        periodEnd: period.end,
        value: "false",
        source: "explicit",
        sourceEntityId: null,
      },
      update: { value: "false", source: "explicit", sourceEntityId: null },
    });
    await testPrisma().$transaction(async (tx) =>
      reversePropagateForBlock(tx, user.id, block.id, TZ),
    );

    const after = await testPrisma().task.findUniqueOrThrow({ where: { id: task.id } });
    expect(after.done).toBe(false);
    // A decisão explícita do usuário permanece no banco.
    const completion = await testPrisma().timeBlockCompletion.findFirstOrThrow({
      where: { timeBlockId: block.id, periodStart: period.start },
    });
    expect(completion.value).toBe("false");
    expect(completion.source).toBe("explicit");
  });

  it("reabrir a tarefa remove as auto-confirmações que ela originou", async () => {
    const user = await createUser();
    const routine = await createRoutine(user.id);
    const blockB = await pastBlock(routine.id, { confirmation: "checklist", title: "B" });
    const task = await createTask(user.id);
    await createConnection(user.id, blockB.id, { taskId: task.id });

    // Simula a rota: usuário marca a tarefa feita -> auto-confirma o bloco B.
    await testPrisma().$transaction(async (tx) => {
      await tx.task.update({ where: { id: task.id }, data: { done: true } });
      const { completedSubtaskIds, taskCompleted } = await markTaskDoneCascade(tx, task.id, false);
      await confirmBlocksForDoneEntities(tx, taskCompleted ? [task.id] : [], completedSubtaskIds, TZ, NOW);
    });
    expect(
      (await testPrisma().timeBlockCompletion.findMany({ where: { timeBlockId: blockB.id } })).length,
    ).toBe(1);

    // Rota reabre: done:false + reverse.
    await testPrisma().task.update({ where: { id: task.id }, data: { done: false } });
    await testPrisma().$transaction(async (tx) =>
      reversePropagateForEntities(tx, user.id, [{ taskId: task.id, subtaskId: null }], TZ),
    );

    const bCompletions = await testPrisma().timeBlockCompletion.findMany({
      where: { timeBlockId: blockB.id },
    });
    expect(bCompletions).toHaveLength(0);
    const taskAfter = await testPrisma().task.findUniqueOrThrow({ where: { id: task.id } });
    expect(taskAfter.done).toBe(false);
  });

  it("excluir uma entidade remove suas auto-confirmações e reabre as demais do bloco", async () => {
    const user = await createUser();
    const routine = await createRoutine(user.id);
    const blockA = await pastBlock(routine.id, { confirmation: "checklist" });
    const blockB = await pastBlock(routine.id, { confirmation: "checklist", title: "B" });
    const t1 = await createTask(user.id, { title: "T1" });
    const t2 = await createTask(user.id, { title: "T2" });
    await createConnection(user.id, blockA.id, { taskId: t1.id });
    await createConnection(user.id, blockB.id, { taskId: t1.id });
    await createConnection(user.id, blockB.id, { taskId: t2.id });

    // Simula a rota: usuário marca T1 feita -> auto-confirma A e B.
    await testPrisma().$transaction(async (tx) => {
      await tx.task.update({ where: { id: t1.id }, data: { done: true } });
      const { completedSubtaskIds, taskCompleted } = await markTaskDoneCascade(tx, t1.id, false);
      await confirmBlocksForDoneEntities(tx, taskCompleted ? [t1.id] : [], completedSubtaskIds, TZ, NOW);
    });
    // B agora tem uma auto-confirmação de T1: T2 completa ao reavaliar B.
    await testPrisma().$transaction(async (tx) =>
      completeEntitiesForBlock(tx, user.id, blockB.id, TZ, NOW),
    );
    expect((await testPrisma().task.findUniqueOrThrow({ where: { id: t2.id } })).done).toBe(true);

    // Simula DELETE de T1: captura blocos antes, exclui, reverte.
    const removedBlockIds = [
      ...new Set(
        (
          await testPrisma().taskBlockConnection.findMany({
            where: { taskId: t1.id },
            select: { timeBlockId: true },
          })
        ).map((c) => c.timeBlockId),
      ),
    ];
    await testPrisma().task.delete({ where: { id: t1.id } });
    await testPrisma().$transaction(async (tx) =>
      reversePropagateForEntities(
        tx,
        user.id,
        [{ taskId: t1.id, subtaskId: null }],
        TZ,
        removedBlockIds,
      ),
    );

    // Auto-confirmação de T1 em B foi removida e T2 reaberta (sem confirmação).
    const bCompletions = await testPrisma().timeBlockCompletion.findMany({
      where: { timeBlockId: blockB.id },
    });
    expect(bCompletions).toHaveLength(0);
    const t2After = await testPrisma().task.findUniqueOrThrow({ where: { id: t2.id } });
    expect(t2After.done).toBe(false);
  });

  it("entidade legítima não é reaberta quando a remoção não a afeta", async () => {
    const user = await createUser();
    const routine = await createRoutine(user.id);
    const block = await pastBlock(routine.id, { confirmation: "checklist" });
    const t1 = await createTask(user.id, { title: "T1" });
    const t2 = await createTask(user.id, { title: "T2" });
    await createConnection(user.id, block.id, { taskId: t1.id });
    await createConnection(user.id, block.id, { taskId: t2.id });

    const period = periodForFrequency("daily", NOW, TZ);
    await createCompletion(user.id, block.id, period.start, "true");
    await testPrisma().$transaction(async (tx) =>
      completeEntitiesForBlock(tx, user.id, block.id, TZ, NOW),
    );
    expect((await testPrisma().task.findUniqueOrThrow({ where: { id: t1.id } })).done).toBe(true);
    expect((await testPrisma().task.findUniqueOrThrow({ where: { id: t2.id } })).done).toBe(true);

    await testPrisma().task.delete({ where: { id: t2.id } });
    await testPrisma().$transaction(async (tx) =>
      reversePropagateForEntities(
        tx,
        user.id,
        [{ taskId: t2.id, subtaskId: null }],
        TZ,
        [block.id],
      ),
    );

    // T1 continua feito: a confirmação explícita do bloco segue valendo.
    const t1After = await testPrisma().task.findUniqueOrThrow({ where: { id: t1.id } });
    expect(t1After.done).toBe(true);
  });

  it("reabrir sub-tarefa reabre a cadeia de ancestrais e a tarefa", async () => {
    const user = await createUser();
    const routine = await createRoutine(user.id);
    const block = await pastBlock(routine.id, { confirmation: "checklist" });
    const task = await createTask(user.id);
    const root = await testPrisma().subtask.create({
      data: { taskId: task.id, title: "root" },
    });
    const child = await testPrisma().subtask.create({
      data: { taskId: task.id, title: "child", parentId: root.id },
    });
    await createConnection(user.id, block.id, { subtaskId: child.id });

    const period = periodForFrequency("daily", NOW, TZ);
    await createCompletion(user.id, block.id, period.start, "true");
    await testPrisma().$transaction(async (tx) =>
      completeEntitiesForBlock(tx, user.id, block.id, TZ, NOW),
    );
    expect((await testPrisma().task.findUniqueOrThrow({ where: { id: task.id } })).done).toBe(true);

    // Rota reabre a sub-tarefa: done:false + reverse com nó + ancestrais + tarefa.
    await testPrisma().subtask.update({ where: { id: child.id }, data: { done: false } });
    await testPrisma().subtask.update({ where: { id: root.id }, data: { done: false } });
    await testPrisma().task.update({ where: { id: task.id }, data: { done: false } });
    await testPrisma().$transaction(async (tx) =>
      reversePropagateForEntities(
        tx,
        user.id,
        [
          { taskId: null, subtaskId: child.id },
          { taskId: null, subtaskId: root.id },
          { taskId: task.id, subtaskId: null },
        ],
        TZ,
      ),
    );

    const taskAfter = await testPrisma().task.findUniqueOrThrow({ where: { id: task.id } });
    expect(taskAfter.done).toBe(false);
    const rootAfter = await testPrisma().subtask.findUniqueOrThrow({ where: { id: root.id } });
    expect(rootAfter.done).toBe(false);
  });
});