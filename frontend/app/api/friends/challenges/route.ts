import { NextResponse } from "next/server";

import { badRequest, notFound, requireUser } from "@/lib/server/api";
import {
  hasOpenChallengeBetween,
  loadChallengesForUser,
} from "@/lib/server/challenges";
import { notifyChallengeReceived } from "@/lib/server/push";
import { prisma } from "@/lib/server/prisma";
import { parseChallengeInput } from "@/lib/validation/challenges";

/** GET /api/friends/challenges — propostas, ativos e histórico. */
export async function GET() {
  const { user, response } = await requireUser();
  if (response) return response;

  const challenges = await loadChallengesForUser(user.id);
  return NextResponse.json(challenges);
}

/** POST — propor desafio a um amigo aceito. */
export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;

  const payload = parseChallengeInput(await request.json());
  if (!payload.ok) return badRequest(payload.error);
  const { friendId, metric, target, durationDays } = payload.data;

  if (friendId === user.id) return badRequest("You cannot challenge yourself");

  // Só desafia amigo ACEITO.
  const friendship = await prisma.friendship.findFirst({
    where: {
      status: "accepted",
      OR: [
        { requesterId: user.id, addresseeId: friendId },
        { requesterId: friendId, addresseeId: user.id },
      ],
    },
    select: { id: true },
  });
  if (!friendship) return notFound("Friend not found");

  // Um desafio aberto por vez entre o par.
  if (await hasOpenChallengeBetween(user.id, friendId)) {
    return badRequest("There is already an open challenge between you");
  }

  const friend = await prisma.user.findUnique({
    where: { id: friendId },
    select: { name: true },
  });
  if (!friend) return notFound("Friend not found");

  const challenge = await prisma.challenge.create({
    data: {
      challengerId: user.id,
      challengedId: friendId,
      metric,
      target,
      durationDays,
      status: "pending",
    },
  });

  await notifyChallengeReceived(friendId, user.name, challenge.id, {
    metric,
    target,
    days: durationDays,
  });

  return NextResponse.json({ id: challenge.id }, { status: 201 });
}
