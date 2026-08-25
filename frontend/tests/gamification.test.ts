import { describe, expect, it } from "vitest";

import { ACHIEVEMENTS } from "@/lib/gamification/achievements-catalog";
import {
  cumulativeXpForLevel,
  levelFromXp,
  levelProgress,
} from "@/lib/gamification/levels";
import { ACHIEVEMENT_TIER_XP, XP_AMOUNTS } from "@/lib/gamification/rules";
import { nextRank, RANKS, rankFromLevel } from "@/lib/gamification/ranks";
import { LUCIDE_ICON_MAP } from "@/lib/lucide-icons";
import { blockConfirmXp } from "@/lib/server/gamification/xp";

describe("curva de níveis", () => {
  it("limites exatos dos níveis", () => {
    expect(cumulativeXpForLevel(1)).toBe(0);
    expect(cumulativeXpForLevel(2)).toBe(75);
    expect(cumulativeXpForLevel(3)).toBe(225);
  });

  it("mapeia XP para o nível correto", () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(74)).toBe(1);
    expect(levelFromXp(75)).toBe(2);
    expect(levelFromXp(224)).toBe(2);
    expect(levelFromXp(225)).toBe(3);
    expect(levelFromXp(-10)).toBe(1); // nunca negativo
  });

  it("progresso dentro do nível", () => {
    const { progress, xpToNextLevel } = levelProgress(150); // meio do nível 2
    expect(progress).toBe(50);
    expect(xpToNextLevel).toBe(225 - 150);
  });
});

describe("ranks", () => {
  it("faixas de nível mapeiam para o rank correto", () => {
    expect(rankFromLevel(1).id).toBe("iniciante");
    expect(rankFromLevel(5).id).toBe("iniciante"); // aprendiz começa no 6
    expect(rankFromLevel(6).id).toBe("aprendiz");
    expect(rankFromLevel(11).id).toBe("aprendiz");
    expect(rankFromLevel(12).id).toBe("bronze");
    expect(rankFromLevel(20).id).toBe("prata");
    expect(rankFromLevel(30).id).toBe("ouro");
    expect(rankFromLevel(42).id).toBe("platina");
    expect(rankFromLevel(56).id).toBe("diamante");
    expect(rankFromLevel(72).id).toBe("lendario");
    expect(rankFromLevel(999).id).toBe("lendario");
  });

  it("todo rank tem ícone conhecido no catálogo Lucide", () => {
    for (const rank of RANKS) {
      expect(LUCIDE_ICON_MAP[rank.icon]).toBeDefined();
    }
  });

  it("nextRank aponta para o próximo e é null no máximo", () => {
    expect(nextRank(1)?.id).toBe("aprendiz");
    expect(nextRank(5)?.minLevel).toBe(6);
    expect(nextRank(72)).toBeNull();
  });
});

describe("catálogo de conquistas", () => {
  it("ids são únicos e toda conquista tem condições válidas", () => {
    const ids = new Set(ACHIEVEMENTS.map((a) => a.id));
    expect(ids.size).toBe(ACHIEVEMENTS.length);
    for (const achievement of ACHIEVEMENTS) {
      expect(achievement.conditions.length).toBeGreaterThan(0);
      for (const condition of achievement.conditions) {
        expect(condition.target).toBeGreaterThan(0);
      }
      expect(ACHIEVEMENT_TIER_XP[achievement.tier]).toBe(
        achievement.xpReward,
      );
    }
  });
});

describe("XP de blocos", () => {
  it("checklist: só \x27true\x27 pontua", () => {
    expect(blockConfirmXp("checklist", "true")).toBe(XP_AMOUNTS.blockChecklist);
    expect(blockConfirmXp("checklist", "false")).toBe(0);
  });

  it("score: +1 por ponto de nota (1 a 10)", () => {
    expect(blockConfirmXp("score", "1")).toBe(1);
    expect(blockConfirmXp("score", "10")).toBe(10);
    expect(blockConfirmXp("score", "0")).toBe(0);
    expect(blockConfirmXp("score", "abc")).toBe(0);
  });

  it("blocos sem confirmação não pontuam", () => {
    expect(blockConfirmXp("none", "true")).toBe(0);
  });
});
