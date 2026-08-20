import { describe, expect, it } from "vitest";
import { computeStreak } from "@/lib/streak";
import type { DailyProgress } from "@/types/domain";

const DAY = 86_400_000;
const TODAY = new Date("2024-01-10T00:00:00.000Z");

function day(date: string, value: number | null): DailyProgress {
  return { date, value, confirmableBlocks: 1, confirmedValue: value ?? 0 };
}

/** Data do início do dia local, `offsetDays` antes de TODAY. */
function dayKey(offsetDays: number): string {
  return new Date(TODAY.getTime() - offsetDays * DAY).toISOString();
}

describe("computeStreak", () => {
  it("sem progresso ou sem dias 100% não tem streak", () => {
    expect(computeStreak([], TODAY)).toEqual({ current: 0, longest: 0, lastFullDay: null });
    expect(computeStreak([day(dayKey(0), 80)], TODAY)).toEqual({
      current: 0,
      longest: 0,
      lastFullDay: null,
    });
  });

  it("conta os dias 100% consecutivos até hoje", () => {
    const progress = [
      day(dayKey(4), 100),
      day(dayKey(3), 100),
      day(dayKey(2), 100),
      day(dayKey(1), 100),
      day(dayKey(0), 100),
    ];
    expect(computeStreak(progress, TODAY)).toEqual({
      current: 5,
      longest: 5,
      lastFullDay: dayKey(0),
    });
  });

  it("hoje incompleto não quebra a sequência (conta até ontem)", () => {
    const progress = [
      day(dayKey(3), 100),
      day(dayKey(2), 100),
      day(dayKey(1), 100),
      day(dayKey(0), 50),
    ];
    expect(computeStreak(progress, TODAY)).toEqual({
      current: 3,
      longest: 3,
      lastFullDay: dayKey(1),
    });
  });

  it("sequência quebrada (último 100% há 2+ dias) zera o current", () => {
    const progress = [
      day(dayKey(3), 100),
      day(dayKey(2), 100),
      day(dayKey(1), 50),
      day(dayKey(0), 0),
    ];
    const streak = computeStreak(progress, TODAY);
    expect(streak.current).toBe(0);
    expect(streak.longest).toBe(2);
    expect(streak.lastFullDay).toBe(dayKey(2));
  });

  it("longest captura a maior corrida mesmo quando o current é menor", () => {
    const progress = [
      day(dayKey(9), 100),
      day(dayKey(8), 100),
      day(dayKey(7), 100),
      day(dayKey(6), 100),
      day(dayKey(5), 0),
      day(dayKey(4), 100),
      day(dayKey(3), 100),
      day(dayKey(2), 0),
      day(dayKey(1), 100),
      day(dayKey(0), 100),
    ];
    expect(computeStreak(progress, TODAY)).toEqual({
      current: 2,
      longest: 4,
      lastFullDay: dayKey(0),
    });
  });

  it("dias não aplicáveis (null) nunca contam como completo", () => {
    const progress = [
      day(dayKey(2), null),
      day(dayKey(1), 100),
      day(dayKey(0), 100),
    ];
    expect(computeStreak(progress, TODAY)).toEqual({
      current: 2,
      longest: 2,
      lastFullDay: dayKey(0),
    });
  });
});