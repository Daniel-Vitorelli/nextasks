import { describe, expect, it } from "vitest";
import {
  applyTimeOfDay,
  applyTimeToDate,
  createBlockStub,
  fromCalendarEvent,
  parseTimeInput,
  toCalendarEvent,
} from "@/lib/time-blocks";
import type { TimeBlock } from "@/types/domain";

function timeBlock(overrides: Partial<TimeBlock> = {}): TimeBlock {
  return {
    id: "b1",
    routineId: "r1",
    title: "Meditar",
    description: "10 minutos",
    start: "2024-01-10T10:00:00.000Z",
    end: "2024-01-10T10:30:00.000Z",
    isAllDay: false,
    color: "green",
    confirmation: "checklist",
    ...overrides,
  };
}

describe("toCalendarEvent", () => {
  it("converte TimeBlock em CalendarEvent preservando datas", () => {
    const event = toCalendarEvent(timeBlock());
    expect(event.id).toBe("b1");
    expect(event.title).toBe("Meditar");
    expect(event.start).toEqual(new Date("2024-01-10T10:00:00.000Z"));
    expect(event.end).toEqual(new Date("2024-01-10T10:30:00.000Z"));
    expect(event.description).toBe("10 minutos");
    expect(event.color).toBe("green");
  });

  it("description null vira undefined", () => {
    const event = toCalendarEvent(timeBlock({ description: null }));
    expect(event.description).toBeUndefined();
  });
});

describe("fromCalendarEvent", () => {
  it("produz um patch válido para o servidor", () => {
    const event = toCalendarEvent(timeBlock());
    const patch = fromCalendarEvent(event);
    expect(patch.title).toBe("Meditar");
    expect(patch.start).toEqual(new Date("2024-01-10T10:00:00.000Z"));
    expect(patch.isAllDay).toBe(false);
  });

  it("aplica defaults quando o evento não tem cor/confirmação", () => {
    const patch = fromCalendarEvent({
      id: "x",
      title: "T",
      start: new Date(),
      end: new Date(),
      isAllDay: undefined,
      color: undefined,
      confirmation: undefined,
    });
    expect(patch.color).toBe("green");
    expect(patch.confirmation).toBe("none");
  });
});

describe("createBlockStub", () => {
  it("cria bloco de 1h a partir do horário informado", () => {
    const anchor = new Date(2024, 0, 10, 15, 45);
    const stub = createBlockStub(anchor);
    expect(stub.start.getHours()).toBe(15);
    expect(stub.start.getMinutes()).toBe(0);
    expect(stub.end.getTime() - stub.start.getTime()).toBe(3_600_000);
  });

  it("não cruza a meia-noite", () => {
    const anchor = new Date(2024, 0, 10, 23, 30);
    const stub = createBlockStub(anchor);
    expect(stub.start.getDate()).toBe(10);
    expect(stub.end.getDate()).toBe(10);
    expect(stub.end.getHours()).toBe(23);
  });
});

describe("parseTimeInput", () => {
  it("aceita 24h", () => {
    expect(parseTimeInput("15:00")).toEqual({ hours: 15, minutes: 0 });
    expect(parseTimeInput("09:30")).toEqual({ hours: 9, minutes: 30 });
  });

  it("aceita AM/PM com e sem separador", () => {
    expect(parseTimeInput("3 PM")).toEqual({ hours: 15, minutes: 0 });
    expect(parseTimeInput("3:30 PM")).toEqual({ hours: 15, minutes: 30 });
    expect(parseTimeInput("3pm")).toEqual({ hours: 15, minutes: 0 });
    expect(parseTimeInput("330pm")).toEqual({ hours: 15, minutes: 30 });
    expect(parseTimeInput("12 AM")).toEqual({ hours: 0, minutes: 0 });
    expect(parseTimeInput("12 PM")).toEqual({ hours: 12, minutes: 0 });
  });

  it("rejeita entradas inválidas", () => {
    expect(parseTimeInput("")).toBeNull();
    expect(parseTimeInput("   ")).toBeNull();
    expect(parseTimeInput("abc")).toBeNull();
    expect(parseTimeInput("25:00")).toBeNull();
    expect(parseTimeInput("12:60")).toBeNull();
    expect(parseTimeInput("1:2:3")).toBeNull();
  });
});

describe("applyTimeToDate", () => {
  it("troca a hora mantendo o dia", () => {
    // Construtor local: independe do fuso do host (a função usa setHours local).
    const base = new Date(2024, 0, 10);
    const result = applyTimeToDate(base, 8, 15);
    expect(result.getHours()).toBe(8);
    expect(result.getMinutes()).toBe(15);
    expect(result.getDate()).toBe(10);
  });
});

describe("applyTimeOfDay", () => {
  it("copia horário de source para a data de target", () => {
    const target = new Date(2024, 1, 15);
    const source = new Date(2024, 0, 10, 10, 30);
    const result = applyTimeOfDay(target, source);
    expect(result.getDate()).toBe(15);
    expect(result.getMonth()).toBe(1);
    expect(result.getHours()).toBe(10);
    expect(result.getMinutes()).toBe(30);
  });
});