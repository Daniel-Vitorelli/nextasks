import type { Prisma } from "@/generated/prisma/client";
import type { ChallengeView, FriendProfile } from "@/types/domain";
import { prisma } from "@/lib/server/prisma";
import { loadFriendProfiles } from "@/lib/server/public-profile";

type Db = Prisma.TransactionClient;

/** XP bônus creditado ao vencedor do desafio. */
export const CHALLENGE_WIN_XP = 75;

/* --------------------------- Métricas / janela -------------------------- */

export interface ChallengeWindow {
  start: Date;
  end: Date;
}

/**
 * Valor da métrica de um participante dentro da janela do desafio.
 * Todas as métricas derivam do ledger XpEvent (espelhado nos undos —
 * desfazer ação reduz o progresso ao vivo).
 */
export async function computeMetricValue(
  db: Db,
  userId: string,
  metric: string,
  window: ChallengeWindow,
): Promise<number> {
  if (metric === "xp") {
    const aggregate = await db.xpEvent.aggregate({
      where: { userId, createdAt: { gte: window.start, lt: window.end }, amount: { gt: 0 } },
      _sum: { amount: true },
    });
    return aggregate._sum.amount ?? 0;
  }

  const kinds =
    metric === "blocks"
      ? ["block.confirm"]
      : metric === "tasks"
        ? ["task.done"]
        : ["habit.confirm"]; // habits

  const count = await db.xpEvent.count({
    where: { userId, kind: { in: kinds }, createdAt: { gte: window.start, lt: window.end } },
  });
  return count;
}

/**
 * Resolução pura do resultado (testável): retorna o userId do vencedor ou
 * null em caso de empate.
 */
export function resolveWinner(
  challengerId: string,
  challengedId: string,
  challengerValue: number,
  challengedValue: number,
): string | null {
  if (challengerValue > challengedValue) return challengerId;
  if (challengedValue > challengerValue) return challengedId;
  return null;
}

/* ------------------------------ Listagem -------------------------------- */

type ChallengeRow = Prisma.ChallengeGetPayload<object>;

function toParticipant(profile: FriendProfile) {
  return { userId: profile.id, name: profile.name, image: profile.image };
}

/** Monta a view completa; quando ativa, inclui progresso ao vivo dos dois lados. */
async function toChallengeView(
  row: ChallengeRow,
  profiles: Map<string, FriendProfile>,
): Promise<ChallengeView | null> {
  const challengerProfile = profiles.get(row.challengerId);
  const challengedProfile = profiles.get(row.challengedId);
  if (!challengerProfile || !challengedProfile) return null;

  const view: ChallengeView = {
    id: row.id,
    metric: row.metric as ChallengeView["metric"],
    target: row.target,
    durationDays: row.durationDays,
    status: row.status as ChallengeView["status"],
    challenger: toParticipant(challengerProfile),
    challenged: toParticipant(challengedProfile),
    createdAt: row.createdAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    endsAt: row.endsAt?.toISOString() ?? null,
    winnerId: row.winnerId ?? null,
  };

  if (row.status === "active" && row.startedAt && row.endsAt) {
    const window = { start: row.startedAt, end: row.endsAt };
    const [challengerValue, challengedValue] = await Promise.all([
      computeMetricValue(prisma, row.challengerId, row.metric, window),
      computeMetricValue(prisma, row.challengedId, row.metric, window),
    ]);
    view.progress = { challengerValue, challengedValue };
    view.daysLeft = Math.max(
      0,
      Math.ceil((row.endsAt.getTime() - Date.now()) / 86_400_000),
    );
  }

  return view;
}

/** Lista todos os desafios do usuário agrupados por estado para a aba Social. */
export async function loadChallengesForUser(userId: string): Promise<{
  incoming: ChallengeView[];
  outgoing: ChallengeView[];
  active: ChallengeView[];
  history: ChallengeView[];
}> {
  const rows = await prisma.challenge.findMany({
    where: { OR: [{ challengerId: userId }, { challengedId: userId }] },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  const profiles = await loadFriendProfiles(prisma, [
    ...new Set(rows.flatMap((row) => [row.challengerId, row.challengedId])),
  ]);

  const result = {
    incoming: [] as ChallengeView[],
    outgoing: [] as ChallengeView[],
    active: [] as ChallengeView[],
    history: [] as ChallengeView[],
  };

  for (const row of rows) {
    const view = await toChallengeView(row, profiles);
    if (!view) continue;
    if (row.status === "pending") {
      if (row.challengedId === userId) result.incoming.push(view);
      else result.outgoing.push(view);
    } else if (row.status === "active") {
      result.active.push(view);
    } else {
      result.history.push(view);
    }
  }

  return result;
}

/** Existe desafio pendente/ativo entre o par (qualquer direção)? */
export async function hasOpenChallengeBetween(
  userA: string,
  userB: string,
): Promise<boolean> {
  const count = await prisma.challenge.count({
    where: {
      status: { in: ["pending", "active"] },
      OR: [
        { challengerId: userA, challengedId: userB },
        { challengerId: userB, challengedId: userA },
      ],
    },
  });
  return count > 0;
}
