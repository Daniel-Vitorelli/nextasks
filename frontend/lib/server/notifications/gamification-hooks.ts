import { levelFromXp } from "@/lib/gamification/levels";
import { recordActivity } from "@/lib/server/activity";
import { prisma } from "@/lib/server/prisma";
import { notifyAchievement, notifyLevelUp } from "@/lib/server/push";

/**
 * Pushes de gamificação — chamar APÓS o commit da transação da mutação:
 * - conquista recém-desbloqueada (ids vindos de evaluateAchievements);
 * - subida de nível, detectada comparando o nível atual (SUM do ledger de XP)
 *   com o maior nível já notificado (baseline criado silenciosamente na
 *   primeira execução para não disparar níveis anteriores à feature).
 * Nunca derruba a mutação que a originou.
 */
export async function sendGamificationNotifications(
  userId: string,
  options?: { newlyUnlockedAchievements?: string[] },
): Promise<void> {
  try {
    const unlocks = options?.newlyUnlockedAchievements ?? [];
    await Promise.allSettled([
      ...unlocks.map((achievementId) =>
        notifyAchievement(userId, achievementId, Date.now()),
      ),
      // Feed de atividade: registra independente das preferências de push.
      ...unlocks.map((achievementId) =>
        recordActivity(userId, "achievement.unlock", { achievementId }),
      ),
    ]);

    const aggregate = await prisma.xpEvent.aggregate({
      where: { userId },
      _sum: { amount: true },
    });
    const level = levelFromXp(aggregate._sum.amount ?? 0);

    const lastLog = await prisma.notificationLog.findFirst({
      where: { userId, kind: "level.up" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });

    if (!lastLog) {
      // Baseline silencioso: nível atual vira o piso notificado, sem push.
      await prisma.notificationLog
        .create({
          data: { userId, kind: "level.up", refKey: `level:${level}` },
        })
        .catch(() => undefined);
      return;
    }

    const highestNotified =
      Number.parseInt(lastLog.refKey?.split(":")[1] ?? "", 10) || 1;
    if (level > highestNotified) {
      await recordActivity(userId, "level.up", { level });
      await notifyLevelUp(userId, level);
    }
  } catch (error) {
    console.warn("[gamification-push] failed:", error);
  }
}
