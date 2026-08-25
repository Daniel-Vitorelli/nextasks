import type { Prisma } from "@/generated/prisma/client";
import { levelFromXp, levelProgress } from "@/lib/gamification/levels";
import { nextRank, rankFromLevel } from "@/lib/gamification/ranks";
import { ACHIEVEMENTS } from "@/lib/gamification/achievements-catalog";
import { awardXpOnce } from "./xp";
import {
  loadGamificationStats,
  type GamificationStatsSnapshot,
} from "./stats";
import type {
  AchievementView,
  GamificationSummary,
  XpEventRow,
} from "@/types/domain";

type Db = Prisma.TransactionClient;

/**
 * Avalia todas as conquistas do catálogo contra o snapshot e persiste os
 * desbloqueios novos (idempotente por unique). Cada unlock concede o XP do
 * tier (awardXpOnce evita recompensa duplicada).
 */
export async function evaluateAchievements(
  tx: Db,
  userId: string,
  snapshot: GamificationStatsSnapshot,
): Promise<string[]> {
  const unlocked = await tx.achievementUnlock.findMany({
    where: { userId },
    select: { achievementId: true },
  });
  const owned = new Set(unlocked.map((row) => row.achievementId));

  const newlyUnlocked: string[] = [];
  for (const definition of ACHIEVEMENTS) {
    if (owned.has(definition.id)) continue;
    const passes = definition.conditions.every((condition) => {
      const value =
        snapshot[condition.stat as keyof GamificationStatsSnapshot] ?? 0;
      return typeof value === "number" && value >= condition.target;
    });
    if (!passes) continue;

    try {
      await tx.achievementUnlock.create({
        data: { userId, achievementId: definition.id },
      });
      await awardXpOnce(
        tx,
        userId,
        "achievement",
        definition.xpReward,
        `achievement:${definition.id}`,
      );
      newlyUnlocked.push(definition.id);
    } catch {
      // Corrida benigna: outra transação desbloqueou primeiro.
    }
  }
  return newlyUnlocked;
}

/** Resumo completo consumido por GET /api/gamification. */
export async function buildGamificationSummary(
  db: Prisma.TransactionClient,
  userId: string,
  options: { recentLimit?: number } = {},
): Promise<GamificationSummary> {
  const recentLimit = Math.min(200, Math.max(10, options.recentLimit ?? 50));
  const stats = await loadGamificationStats(db, userId, new Date().getTimezoneOffset());
  const [unlockedRows, eventRows, breakdownRows] = await Promise.all([
    db.achievementUnlock.findMany({
      where: { userId },
      orderBy: { unlockedAt: "desc" },
    }),
    db.xpEvent.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: recentLimit,
    }),
    db.xpEvent.groupBy({
      by: ["kind"],
      where: { userId },
      _sum: { amount: true },
    }),
  ]);

  // Reavalia conquistas na leitura também: streaks e dias limpos evoluem com
  // o passar do tempo sem mutação explícita. Se algo desbloqueou, o snapshot
  // é recalculado (XP de recompensa muda total/nível/progresso).
  let unlocks = unlockedRows;
  const newlyUnlocked = await db.$transaction(async (tx) =>
    evaluateAchievements(tx, userId, stats),
  );
  if (newlyUnlocked.length > 0) {
    unlocks = await db.achievementUnlock.findMany({
      where: { userId },
      orderBy: { unlockedAt: "desc" },
    });
    const refreshed = await loadGamificationStats(
      db,
      userId,
      new Date().getTimezoneOffset(),
    );
    stats.totalXp = refreshed.totalXp;
    stats.level = refreshed.level;
  }

  const totalXp = stats.totalXp;
  const level = levelFromXp(totalXp);
  const { progress, xpToNextLevel } = levelProgress(totalXp);

  const unlockById = new Map(
    unlocks.map((row) => [row.achievementId, row.unlockedAt.toISOString()]),
  );

  const achievements: AchievementView[] = ACHIEVEMENTS.map((definition) => {
    const progressValues = definition.conditions.map((condition) => {
      const value =
        (stats[condition.stat as keyof GamificationStatsSnapshot] as number | undefined) ?? 0;
      return Math.min(100, Math.round((value / condition.target) * 100));
    });
    return {
      ...definition,
      nameKey: `app.gamification.achievements.${definition.id}.name`,
      descriptionKey: `app.gamification.achievements.${definition.id}.description`,
      unlockedAt: unlockById.get(definition.id) ?? null,
      progress:
        progressValues.length > 0 ? Math.min(...progressValues) : 0,
    };
  });

  const recentEvents: XpEventRow[] = eventRows.map((event) => ({
    id: event.id,
    kind: event.kind,
    refKey: event.refKey,
    amount: event.amount,
    createdAt: event.createdAt.toISOString(),
  }));

  const breakdown = breakdownRows
    .map((row) => ({
      kind: row.kind,
      amount: row._sum.amount ?? 0,
    }))
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

  return {
    totalXp,
    level,
    levelProgress: progress,
    xpToNextLevel,
    rank: rankFromLevel(level),
    nextRank: nextRank(level),
    achievements,
    unlockedCount: achievements.filter((a) => a.unlockedAt !== null).length,
    recentEvents,
    breakdown,
    bestRoutineStreak: stats.bestRoutineStreak,
    bestCleanStreak: stats.bestCleanStreak,
    currentRoutineStreak: stats.currentRoutineStreak,
    currentCleanStreak: stats.currentCleanStreak,
  };
}
