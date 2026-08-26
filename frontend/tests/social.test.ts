import { describe, expect, it } from "vitest";

import { parseFriendInviteInput } from "@/lib/validation/friends";
import { parseActivityData, type ActivityKind } from "@/lib/server/activity";
import { sortLeaderboardEntries } from "@/lib/server/social";
import type { LeaderboardEntry } from "@/types/domain";

function entry(partial: Partial<LeaderboardEntry>): LeaderboardEntry {
  return {
    userId: "u",
    name: "User",
    image: null,
    weekXp: 0,
    level: 1,
    rank: {
      id: "iniciante",
      nameKey: "ranks.iniciante",
      minLevel: 1,
      color: "gray",
      icon: "Sprout",
    },
    isMe: false,
    ...partial,
  };
}

describe("sortLeaderboardEntries", () => {
  it("ordena por XP da semana desc e marca posições estáveis", () => {
    const sorted = sortLeaderboardEntries([
      entry({ userId: "a", weekXp: 50 }),
      entry({ userId: "b", weekXp: 200 }),
      entry({ userId: "c", weekXp: 120 }),
    ]);
    expect(sorted.map((row) => row.userId)).toEqual(["b", "c", "a"]);
  });

  it("desempata por nível e depois por nome", () => {
    const sorted = sortLeaderboardEntries([
      entry({ userId: "a", weekXp: 100, level: 3, name: "Zeca" }),
      entry({ userId: "b", weekXp: 100, level: 5, name: "Ana" }),
      entry({ userId: "c", weekXp: 100, level: 5, name: "Bruno" }),
    ]);
    expect(sorted.map((row) => row.userId)).toEqual(["b", "c", "a"]);
  });

  it("não muta o array original", () => {
    const original = [entry({ userId: "a", weekXp: 1 }), entry({ userId: "b", weekXp: 2 })];
    sortLeaderboardEntries(original);
    expect(original.map((row) => row.userId)).toEqual(["a", "b"]);
  });
});

describe("parseFriendInviteInput", () => {
  it("aceita userId", () => {
    const result = parseFriendInviteInput({ userId: " abc123 " });
    expect(result).toEqual({ ok: true, data: { userId: "abc123" } });
  });

  it("aceita email válido (normalizado)", () => {
    const result = parseFriendInviteInput({ email: "  Person@Example.COM " });
    expect(result).toEqual({ ok: true, data: { email: "person@example.com" } });
  });

  it("rejeita sem email nem userId ou com valores inválidos", () => {
    expect(parseFriendInviteInput({}).ok).toBe(false);
    expect(parseFriendInviteInput({ email: "nope" }).ok).toBe(false);
    expect(parseFriendInviteInput({ userId: "" }).ok).toBe(false);
    expect(parseFriendInviteInput(null).ok).toBe(false);
  });
});

describe("parseActivityData", () => {
  it("extrai params de strings e números", () => {
    expect(parseActivityData('{"achievementId":"xp-1000","level":5}')).toEqual({
      achievementId: "xp-1000",
      level: 5,
    });
  });

  it("retorna objeto vazio em JSON inválido/estruturas inesperadas", () => {
    expect(parseActivityData("não é json")).toEqual({});
    expect(parseActivityData("[1,2]")).toEqual({});
    expect(parseActivityData("{}")).toEqual({});
    // Valores não primitivos são descartados.
    expect(parseActivityData('{"nested":{"a":1}}')).toEqual({});
  });
});

describe("ActivityKind", () => {
  it("mantém os kinds do contrato do feed", () => {
    const kinds: ActivityKind[] = [
      "achievement.unlock",
      "level.up",
      "friend.accepted",
    ];
    expect(kinds).toHaveLength(3);
  });
});
