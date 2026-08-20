import { beforeEach, describe, expect, it } from "vitest";

import { materializeSchedule } from "@/lib/server/schedule";
import {
  createBlock,
  createRoutine,
  createUser,
  resetDb,
  testPrisma,
} from "./helpers";

const DAY_MS = 86_400_000;

function range(days: number) {
  const start = new Date("2024-01-01T00:00:00.000Z");
  return { start, end: new Date(start.getTime() + (days - 1) * DAY_MS) };
}

describe("materializeSchedule", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("rotina diária gera uma ocorrência por dia, mantendo o horário", async () => {
    const user = await createUser();
    const routine = await createRoutine(user.id, { frequency: "daily" });
    const block = await createBlock(routine.id, {
      title: "Estudar",
      start: new Date("2024-01-01T09:00:00.000Z"),
      end: new Date("2024-01-01T10:00:00.000Z"),
    });

    const { start, end } = range(3);
    const occurrences = await materializeSchedule(user.id, start, end, 0);

    expect(occurrences).toHaveLength(3);
    expect(occurrences[0]).toMatchObject({
      blockId: block.id,
      routineId: routine.id,
      routineName: routine.name,
      title: "Estudar",
    });
    expect(occurrences.map((o) => o.start)).toEqual([
      "2024-01-01T09:00:00.000Z",
      "2024-01-02T09:00:00.000Z",
      "2024-01-03T09:00:00.000Z",
    ]);
  });

  it("rotina semanal gera ocorrência apenas no dia da semana do bloco", async () => {
    const user = await createUser();
    const routine = await createRoutine(user.id, { frequency: "weekly" });
    // 2024-01-03 é quarta-feira (3): o bloco ocorre às quartas.
    await createBlock(routine.id, {
      start: new Date("2024-01-03T08:00:00.000Z"),
      end: new Date("2024-01-03T08:30:00.000Z"),
    });

    // Semana de 31/12 (domingo) a 06/01 (sábado): só 03/01 (quarta).
    const { start, end } = range(7);
    const occurrences = await materializeSchedule(user.id, start, end, 0);

    expect(occurrences).toHaveLength(1);
    expect(occurrences[0].start).toBe("2024-01-03T08:00:00.000Z");
  });

  it("ignora rotinas inativas", async () => {
    const user = await createUser();
    const routine = await createRoutine(user.id, { isActive: false });
    await createBlock(routine.id, {
      start: new Date("2024-01-01T09:00:00.000Z"),
      end: new Date("2024-01-01T10:00:00.000Z"),
    });

    const { start, end } = range(3);
    const occurrences = await materializeSchedule(user.id, start, end, 0);
    expect(occurrences).toHaveLength(0);
  });

  it("rotina com fim não gera ocorrências após o endDate", async () => {
    const user = await createUser();
    const routine = await createRoutine(user.id, { frequency: "daily" });
    await testPrisma().routine.update({
      where: { id: routine.id },
      data: { duration: "until", endDate: new Date("2024-01-05T00:00:00.000Z") },
    });
    await createBlock(routine.id, {
      start: new Date("2024-01-01T09:00:00.000Z"),
      end: new Date("2024-01-01T10:00:00.000Z"),
    });

    const { start, end } = range(10);
    const occurrences = await materializeSchedule(user.id, start, end, 0);

    // Dias 01..05 inclusive.
    expect(occurrences).toHaveLength(5);
    expect(occurrences[4].start).toBe("2024-01-05T09:00:00.000Z");
  });

  it("bloco all-day começa na meia-noite local e dura 24h", async () => {
    const user = await createUser();
    const routine = await createRoutine(user.id);
    await createBlock(routine.id, {
      isAllDay: true,
      start: new Date("2024-01-01T08:00:00.000Z"),
      end: new Date("2024-01-01T08:00:00.000Z"),
    });

    const { start, end } = range(1);
    const occurrences = await materializeSchedule(user.id, start, end, 0);

    expect(occurrences).toHaveLength(1);
    expect(occurrences[0].isAllDay).toBe(true);
    expect(occurrences[0].start).toBe("2024-01-01T00:00:00.000Z");
    expect(occurrences[0].end).toBe("2024-01-02T00:00:00.000Z");
  });

  it("bloco que cruza a meia-noite termina no dia seguinte", async () => {
    const user = await createUser();
    const routine = await createRoutine(user.id);
    await createBlock(routine.id, {
      start: new Date("2024-01-01T23:00:00.000Z"),
      end: new Date("2024-01-02T01:00:00.000Z"),
    });

    const { start, end } = range(1);
    const occurrences = await materializeSchedule(user.id, start, end, 0);

    expect(occurrences).toHaveLength(1);
    expect(occurrences[0].start).toBe("2024-01-01T23:00:00.000Z");
    expect(occurrences[0].end).toBe("2024-01-02T01:00:00.000Z");
  });

  it("respeita o offset do usuário (fuso UTC-3: 09:00 local = 12:00Z)", async () => {
    const user = await createUser();
    const routine = await createRoutine(user.id);
    // 09:00 no fuso UTC-3 = 12:00Z.
    await createBlock(routine.id, {
      start: new Date("2024-01-10T12:00:00.000Z"),
      end: new Date("2024-01-10T13:00:00.000Z"),
    });

    const occurrences = await materializeSchedule(
      user.id,
      new Date("2024-01-10T03:00:00.000Z"),
      new Date("2024-01-10T03:00:00.000Z"),
      180,
    );

    expect(occurrences).toHaveLength(1);
    expect(occurrences[0].start).toBe("2024-01-10T12:00:00.000Z");
    expect(occurrences[0].end).toBe("2024-01-10T13:00:00.000Z");
  });
});