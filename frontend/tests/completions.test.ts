import { describe, expect, it } from "vitest";
import {
  localMinutesOfDay,
  localWeekday,
  periodForFrequency,
  startOfDayUtc,
  startOfWeekUtc,
} from "@/lib/server/completions";

describe("startOfDayUtc", () => {
  it("trunca no dia local com offset 0 (UTC)", () => {
    const date = new Date("2024-01-10T15:30:00.000Z");
    expect(startOfDayUtc(date, 0)).toEqual(new Date("2024-01-10T00:00:00.000Z"));
  });

  it("offset positivo (UTC-3) desloca o início do dia para 03:00 UTC", () => {
    const date = new Date("2024-01-10T15:30:00.000Z");
    expect(startOfDayUtc(date, 180)).toEqual(new Date("2024-01-10T03:00:00.000Z"));
  });

  it("offset negativo (UTC+5) desloca o início do dia para o dia anterior em UTC", () => {
    // 02:00 UTC = 07:00 local (UTC+5) no dia 10 → início do dia local é 00:00 local = 19:00 UTC do dia 9.
    const date = new Date("2024-01-10T02:00:00.000Z");
    expect(startOfDayUtc(date, -300)).toEqual(new Date("2024-01-09T19:00:00.000Z"));
  });

  it("madrugada local já é o dia seguinte em UTC para UTC-3", () => {
    // 01:00 UTC = 22:00 local (UTC-3) do dia 9 → início do dia local é 00:00 do dia 9 = 03:00 UTC do dia 9.
    const date = new Date("2024-01-10T01:00:00.000Z");
    expect(startOfDayUtc(date, 180)).toEqual(new Date("2024-01-09T03:00:00.000Z"));
  });
});

describe("startOfWeekUtc", () => {
  // 2024-01-10 é uma quarta-feira.
  it("retorna domingo 00:00 UTC com offset 0", () => {
    const date = new Date("2024-01-10T15:00:00.000Z");
    expect(startOfWeekUtc(date, 0)).toEqual(new Date("2024-01-07T00:00:00.000Z"));
  });

  it("retorna domingo local com offset positivo", () => {
    const date = new Date("2024-01-10T15:00:00.000Z");
    // Local (UTC-3) = 12:00 de quarta; domingo local = 07/01 00:00 local = 07/01 03:00 UTC.
    expect(startOfWeekUtc(date, 180)).toEqual(new Date("2024-01-07T03:00:00.000Z"));
  });

  it("funciona para domingo (já é início de semana)", () => {
    const date = new Date("2024-01-07T15:00:00.000Z");
    expect(startOfWeekUtc(date, 0)).toEqual(new Date("2024-01-07T00:00:00.000Z"));
  });
});

describe("periodForFrequency", () => {
  it("diária: período de 24h a partir do dia local", () => {
    const now = new Date("2024-01-10T15:00:00.000Z");
    const period = periodForFrequency("daily", now, 0);
    expect(period.start).toEqual(new Date("2024-01-10T00:00:00.000Z"));
    expect(period.end).toEqual(new Date("2024-01-11T00:00:00.000Z"));
  });

  it("semanal: período de 7 dias a partir do domingo local", () => {
    const now = new Date("2024-01-10T15:00:00.000Z");
    const period = periodForFrequency("weekly", now, 0);
    expect(period.start).toEqual(new Date("2024-01-07T00:00:00.000Z"));
    expect(period.end).toEqual(new Date("2024-01-14T00:00:00.000Z"));
  });
});

describe("localWeekday", () => {
  it("retorna o dia da semana no fuso do usuário", () => {
    // 2024-01-10 (quarta) às 23:00 UTC é quinta (4) para UTC+1 (offset -60).
    const date = new Date("2024-01-10T23:00:00.000Z");
    expect(localWeekday(date, 0)).toBe(3);
    expect(localWeekday(date, -60)).toBe(4);
  });
});

describe("localMinutesOfDay", () => {
  it("converte hora local em minutos", () => {
    const date = new Date("2024-01-10T15:30:00.000Z");
    expect(localMinutesOfDay(date, 0)).toBe(15 * 60 + 30);
    expect(localMinutesOfDay(date, 180)).toBe(12 * 60 + 30);
  });
});