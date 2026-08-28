import { NextResponse } from "next/server";

import { badRequest, notFound, requireUser, RouteContext } from "@/lib/server/api";
import { notifyChallengeAccepted } from "@/lib/server/push";
import { prisma } from "@/lib/server/prisma";
import { parseChallengeAction } from "@/lib/validation/challenges";

/**
 * PATCH /api/friends/challenges/:id — aceitar ou recusar (só o desafiado).
 * Aceitar inicia a janela do desafio imediatamente.
 */
export async function PATCH(request: Request, context: RouteContext<{ id: string }>) {
  const { user, response } = await requireUser();
  if (response) return response;

  const { id } = await context.params;
  const payload = parseChallengeAction(await request.json());
  if (!payload.ok) return badRequest(payload.error);

  const challenge = await prisma.challenge.findUnique({ where: { id } });
  if (!challenge || challenge.challengedId !== user.id || challenge.status !== "pending") {
    return notFound("Challenge not found");
  }

  if (payload.data === "decline") {
    await prisma.challenge.delete({ where: { id } });
    return NextResponse.json({ status: "declined" });
  }

  const startedAt = new Date();
  const endsAt = new Date(startedAt.getTime() + challenge.durationDays * 86_400_000);
  await prisma.challenge.update({
    where: { id },
    data: { status: "active", startedAt, endsAt },
  });

  // Avisa o proponente; realtime vai com dados crus para o cliente traduzir.
  const accepted = await prisma.user.findUnique({
    where: { id: user.id },
    select: { name: true },
  });
  await notifyChallengeAccepted(
    challenge.challengerId,
    accepted?.name ?? "",
    challenge.id,
    {
      metric: challenge.metric as "xp" | "blocks" | "tasks" | "habits",
      target: challenge.target,
      days: challenge.durationDays,
    },
  );

  return NextResponse.json({
    status: "active",
    startedAt: startedAt.toISOString(),
    endsAt: endsAt.toISOString(),
  });
}

/** DELETE — cancelar proposta própria pendente. */
export async function DELETE(_request: Request, context: RouteContext<{ id: string }>) {
  const { user, response } = await requireUser();
  if (response) return response;

  const { id } = await context.params;
  const challenge = await prisma.challenge.findUnique({ where: { id } });
  if (!challenge || challenge.challengerId !== user.id || challenge.status !== "pending") {
    return notFound("Challenge not found");
  }

  await prisma.challenge.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
