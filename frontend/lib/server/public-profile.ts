import type { Prisma } from "@/generated/prisma/client";
import type { FriendDetail, FriendProfile, RankDef } from "@/types/domain";
import { levelFromXp } from "@/lib/gamification/levels";
import { rankFromLevel } from "@/lib/gamification/ranks";
import { loadGamificationStats } from "@/lib/server/gamification/stats";

type Db = Prisma.TransactionClient;

function toProfile(row: {
  id: string;
  name: string;
  image: string | null;
  totalXp: number;
}): FriendProfile {
  const level = levelFromXp(row.totalXp);
  const rank: RankDef = rankFromLevel(level);
  return { ...row, level, rank };
}

/**
 * Perfil público leve para listas: uma única query agrupada de XP para
 * N usuários (amigos não veem estatísticas detalhadas um do outro).
 */
export async function loadFriendProfiles(
  db: Db,
  userIds: string[],
): Promise<Map<string, FriendProfile>> {
  const map = new Map<string, FriendProfile>();
  if (userIds.length === 0) return map;

  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, image: true },
  });

  // SUM(amount) por usuário em uma query.
  const grouped = await db.xpEvent.groupBy({
    by: ["userId"],
    where: { userId: { in: userIds } },
    _sum: { amount: true },
  });
  const xpByUser = new Map(
    grouped.map((row) => [row.userId, row._sum.amount ?? 0]),
  );

  for (const user of users) {
    map.set(user.id, toProfile({ ...user, totalXp: xpByUser.get(user.id) ?? 0 }));
  }
  return map;
}

/** Detalhe público do amigo: perfil + recorte leve das estatísticas. */
export async function loadFriendDetail(db: Db, friendId: string): Promise<FriendDetail | null> {
  const user = await db.user.findUnique({
    where: { id: friendId },
    select: { id: true, name: true, image: true, timezoneOffset: true },
  });
  if (!user) return null;

  const stats = await loadGamificationStats(db, friendId, user.timezoneOffset ?? 0);
  const unlockedCount = await db.achievementUnlock.count({ where: { userId: friendId } });

  return {
    profile: toProfile({
      id: user.id,
      name: user.name,
      image: user.image,
      totalXp: stats.totalXp,
    }),
    blocksConfirmed: stats.blocksConfirmed,
    tasksDone: stats.tasksDone,
    days100: stats.days100,
    bestRoutineStreak: stats.bestRoutineStreak,
    currentRoutineStreak: stats.currentRoutineStreak,
    bestCleanStreak: stats.bestCleanStreak,
    unlockedCount,
  };
}
