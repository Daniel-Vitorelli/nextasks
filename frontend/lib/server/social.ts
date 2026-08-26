import type { Prisma } from "@/generated/prisma/client";
import type { ActivityFeedItem, LeaderboardEntry } from "@/types/domain";
import { parseActivityData } from "@/lib/server/activity";
import { startOfWeekUtc } from "@/lib/server/completions";
import { loadFriendProfiles } from "@/lib/server/public-profile";

type Db = Prisma.TransactionClient;

/** Ordenação pura do ranking: XP da semana desc → nível desc → nome asc. */
export function sortLeaderboardEntries(
  entries: LeaderboardEntry[],
): LeaderboardEntry[] {
  return [...entries].sort((a, b) => {
    if (b.weekXp !== a.weekXp) return b.weekXp - a.weekXp;
    if (b.level !== a.level) return b.level - a.level;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Ranking de XP ganho na semana corrente do SOLICITANTE (janela local dele)
 * entre ele mesmo e seus amigos aceitos.
 */
export async function loadWeeklyLeaderboard(
  db: Db,
  userId: string,
  tzOffsetMinutes: number,
): Promise<LeaderboardEntry[]> {
  const now = new Date();
  const weekStart = startOfWeekUtc(now, tzOffsetMinutes);

  const friendships = await db.friendship.findMany({
    where: {
      status: "accepted",
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
    select: { requesterId: true, addresseeId: true },
  });
  const participantIds = [
    userId,
    ...friendships.map((row) =>
      row.requesterId === userId ? row.addresseeId : row.requesterId,
    ),
  ];

  const [profiles, grouped] = await Promise.all([
    loadFriendProfiles(db, participantIds),
    db.xpEvent.groupBy({
      by: ["userId"],
      where: { userId: { in: participantIds }, createdAt: { gte: weekStart } },
      _sum: { amount: true },
    }),
  ]);
  const weekXpByUser = new Map(
    grouped.map((row) => [row.userId, row._sum.amount ?? 0]),
  );

  const entries: LeaderboardEntry[] = [];
  for (const id of participantIds) {
    const profile = profiles.get(id);
    if (!profile) continue;
    entries.push({
      userId: profile.id,
      name: profile.name,
      image: profile.image,
      weekXp: weekXpByUser.get(id) ?? 0,
      level: profile.level,
      rank: profile.rank,
      isMe: id === userId,
    });
  }

  return sortLeaderboardEntries(entries);
}

/** Feed de atividade: eventos recentes do usuário + amigos. */
export async function loadActivityFeed(
  db: Db,
  userId: string,
  limit = 30,
): Promise<ActivityFeedItem[]> {
  const friendships = await db.friendship.findMany({
    where: {
      status: "accepted",
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
    select: { requesterId: true, addresseeId: true },
  });
  const authorIds = [
    userId,
    ...friendships.map((row) =>
      row.requesterId === userId ? row.addresseeId : row.requesterId,
    ),
  ];

  const events = await db.activityEvent.findMany({
    where: { userId: { in: authorIds } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: Math.min(Math.max(1, limit), 50),
  });

  const profiles = await loadFriendProfiles(
    db,
    [...new Set(events.map((event) => event.userId))],
  );

  const items: ActivityFeedItem[] = [];
  for (const event of events) {
    const actor = profiles.get(event.userId);
    if (!actor) continue;
    items.push({
      id: event.id,
      actorId: actor.id,
      actorName: actor.name,
      actorImage: actor.image,
      kind: event.kind as ActivityFeedItem["kind"],
      data: parseActivityData(event.data),
      createdAt: event.createdAt.toISOString(),
    });
  }
  return items;
}
