import { describe, expect, it } from "vitest";
import {
  dateWeekday,
  dayFilterDate,
  dayFilterLabel,
  dayFilterOptions,
  formatClockTime,
  isDateFilter,
  isDayFilterSatisfiable,
  nextDateForWeekday,
  todayLocal,
} from "@/components/connections/connection-utils";
import type { DayFilter } from "@/types/domain";

function fakeT(key: string): string {
  return key;
}

describe("date helpers", () => {
  it("dateWeekday retorna o dia da semana local de YYYY-MM-DD", () => {
    expect(dateWeekday("2026-08-17")).toBe(1);
    expect(dateWeekday("2026-08-20")).toBe(4);
  });

  it("nextDateForWeekday encontra o próximo dia (hoje incluso)", () => {
    const weekday = new Date().getDay();
    expect(nextDateForWeekday(weekday)).toBe(todayLocal());
  });

  it("todayLocal está no formato YYYY-MM-DD", () => {
    expect(todayLocal()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("formatClockTime", () => {
  it("formata minutos desde meia-noite como HH:MM", () => {
    expect(formatClockTime(0)).toBe("00:00");
    expect(formatClockTime(540)).toBe("09:00");
    expect(formatClockTime(570)).toBe("09:30");
    expect(formatClockTime(1439)).toBe("23:59");
  });
});

describe("dayFilter helpers", () => {
  it("isDateFilter identifica filtros de data", () => {
    expect(isDateFilter("all")).toBe(false);
    expect(isDateFilter("weekday:3")).toBe(false);
    expect(isDateFilter("date:2026-08-20")).toBe(true);
  });

  it("dayFilterDate extrai a data do filtro", () => {
    expect(dayFilterDate("date:2026-08-20")).toBe("2026-08-20");
  });
});

describe("isDayFilterSatisfiable (cliente)", () => {
  it("bloco semanal só aceita o próprio dia da semana", () => {
    expect(isDayFilterSatisfiable("weekday:3", "weekly", 3)).toBe(true);
    expect(isDayFilterSatisfiable("weekday:4", "weekly", 3)).toBe(false);
    expect(isDayFilterSatisfiable("all", "weekly", 3)).toBe(true);
  });

  it("data específica precisa cair no dia do bloco semanal", () => {
    expect(isDayFilterSatisfiable("date:2026-08-19", "weekly", 3)).toBe(true);
    expect(isDayFilterSatisfiable("date:2026-08-20", "weekly", 3)).toBe(false);
  });

  it("blocos diários aceitam qualquer filtro", () => {
    expect(isDayFilterSatisfiable("weekday:4", "daily", 3)).toBe(true);
    expect(isDayFilterSatisfiable("date:2026-08-20", "daily", 3)).toBe(true);
    expect(isDayFilterSatisfiable("all", "daily", 3)).toBe(true);
  });
});

describe("dayFilterLabel", () => {
  it("rotula todos os dias e weekday", () => {
    expect(dayFilterLabel("all", fakeT)).toBe("allDays");
    expect(dayFilterLabel("weekday:0", fakeT)).toBe("weekday_0");
  });

  it("rotula data no formato dd/mm/aaaa", () => {
    expect(dayFilterLabel("date:2026-08-20" as DayFilter, fakeT)).toBe(
      "20/08/2026",
    );
  });
});

describe("dayFilterOptions", () => {
  it("bloco semanal oferece all + o próprio dia (data fica separada)", () => {
    const options = dayFilterOptions("weekly", 3);
    expect(options).toEqual([
      { value: "all", labelKey: "allDays" },
      {
        value: "weekday:3",
        labelKey: "weekday_3",
        weekday: 3,
      },
    ]);
  });

  it("bloco diário oferece all + 7 dias da semana", () => {
    const options = dayFilterOptions("daily", 0);
    expect(options).toHaveLength(8);
    expect(options[0]).toEqual({ value: "all", labelKey: "allDays" });
    expect(options[1]).toEqual({
      value: "weekday:0",
      labelKey: "weekday_0",
      weekday: 0,
    });
    expect(options[7]).toEqual({
      value: "weekday:6",
      labelKey: "weekday_6",
      weekday: 6,
    });
  });
});