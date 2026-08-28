import { describe, expect, it } from "vitest";

import {
  challengeMeta,
  challengeResultText,
} from "@/lib/notifications/templates";
import { computeMetricValue } from "@/lib/server/challenges";
import {
  CHALLENGE_DURATIONS,
  CHALLENGE_METRICS,
  parseChallengeAction,
  parseChallengeInput,
} from "@/lib/validation/challenges";
import { vi } from "vitest";

describe("resolveWinner (via lib/server/challenges)", () => {
  // Importado indiretamente para manter o teste puro.
  it("maior valor vence; empate retorna null", async () => {
    const { resolveWinner } = await import("@/lib/server/challenges");
    expect(resolveWinner("a", "b", 100, 90)).toBe("a");
    expect(resolveWinner("a", "b", 90, 100)).toBe("b");
    expect(resolveWinner("a", "b", 100, 100)).toBeNull();
  });
});

describe("parseChallengeInput", () => {
  const valid = {
    friendId: "friend-1",
    metric: "xp",
    target: 1000,
    durationDays: 7,
  };

  it("aceita payload válido", () => {
    const result = parseChallengeInput(valid);
    expect(result).toEqual({ ok: true, data: valid });
  });

  it("rejeita métrica desconhecida e duração fora do catálogo", () => {
    expect(parseChallengeInput({ ...valid, metric: "streak" }).ok).toBe(false);
    expect(parseChallengeInput({ ...valid, durationDays: 5 }).ok).toBe(false);
    expect(CHALLENGE_METRICS).toContain("habits");
    expect(CHALLENGE_DURATIONS).toEqual([3, 7, 14]);
  });

  it("limites de meta por métrica", () => {
    expect(parseChallengeInput({ ...valid, target: 10 }).ok).toBe(false); // xp min 50
    expect(parseChallengeInput({ ...valid, target: 50 }).ok).toBe(true);
    expect(
      parseChallengeInput({ ...valid, metric: "blocks", target: 0 }).ok,
    ).toBe(false);
    expect(
      parseChallengeInput({ ...valid, metric: "tasks", target: 501 }).ok,
    ).toBe(false);
  });

  it("exige friendId e action válida", () => {
    expect(parseChallengeInput({ ...valid, friendId: "" }).ok).toBe(false);
    expect(parseChallengeAction({ action: "maybe" }).ok).toBe(false);
    expect(parseChallengeAction({ action: "accept" })).toEqual({
      ok: true,
      data: "accept",
    });
  });
});

describe("challengeMeta / challengeResultText", () => {
  it("meta legível por locale", () => {
    expect(challengeMeta("pt", "xp", 1200, 7)).toBe("1.200 XP em 7 dias");
    expect(challengeMeta("en", "blocks", 30, 3)).toBe("30 confirmed blocks in 3 days");
    expect(challengeMeta("pt", "habits", 25, 14)).toContain("confirmações de hábito");
  });

  it("resultado na perspectiva do destinatário", () => {
    expect(challengeResultText("pt", "won")).toContain("+75 XP");
    expect(challengeResultText("en", "lost")).toMatch(/lost/i);
    expect(challengeResultText("pt", "draw")).toContain("empatado");
  });
});

describe("computeMetricValue (contrato de janela)", () => {
  it("usa janela [start, end) — mocka o client apenas para validar os filtros", async () => {
    const window = {
      start: new Date("2030-01-01T00:00:00Z"),
      end: new Date("2030-01-08T00:00:00Z"),
    };
    const whereCapture = vi.fn();
    const fakeDb = {
      xpEvent: {
        aggregate: async (args: unknown) => {
          whereCapture(args);
          return { _sum: { amount: 42 } };
        },
        count: async (args: unknown) => {
          whereCapture(args);
          return 3;
        },
      },
    } as never;

    const xp = await computeMetricValue(fakeDb, "u1", "xp", window);
    const blocks = await computeMetricValue(fakeDb, "u1", "blocks", window);

    const [xpArgs, blockArgs] = whereCapture.mock.calls.map(
      (call) => call[0] as { where: Record<string, unknown> },
    );
    // XP soma só positivos dentro da janela.
    const xpWhere = xpArgs.where as {
      amount: unknown;
      createdAt: { gte: Date; lt: Date };
    };
    expect(xpWhere.amount).toEqual({ gt: 0 });
    expect(xpWhere.createdAt.gte).toBe(window.start);
    expect(xpWhere.createdAt.lt).toBe(window.end);
    expect(xp).toBe(42);

    // Blocos contam eventos block.confirm.
    const blockWhere = blockArgs.where as { kind: unknown };
    expect(blockWhere.kind).toEqual({ in: ["block.confirm"] });
    expect(blocks).toBe(3);
  });
});
