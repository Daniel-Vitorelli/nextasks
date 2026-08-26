import { NextResponse } from "next/server";

import { notFound, requireUser, RouteContext } from "@/lib/server/api";
import { recordActivity } from "@/lib/server/activity";
import { notifyFriendAccepted } from "@/lib/server/push";
import { prisma } from "@/lib/server/prisma";
import { parseFriendRequestAction } from "@/lib/validation/friends";

/** PATCH /api/friends/requests/:id — aceitar ou recusar (só o destinatário). */
export async function PATCH(request: Request, context: RouteContext<{ id: string }>) {
  const { user, response } = await requireUser();
  if (response) return response;

  const { id } = await context.params;
  const payload = parseFriendRequestAction(await request.json());
  if (!payload.ok) return NextResponse.json({ error: payload.error }, { status: 400 });

  const friendship = await prisma.friendship.findUnique({ where: { id } });
  if (!friendship || friendship.addresseeId !== user.id || friendship.status !== "pending") {
    return notFound("Request not found");
  }

  if (payload.data === "decline") {
    await prisma.friendship.delete({ where: { id } });
    return NextResponse.json({ status: "declined" });
  }

  const accepted = await prisma.friendship.update({
    where: { id },
    data: { status: "accepted" },
  });

  // Feed de atividade: um evento para cada lado ("X e Y agora são amigos").
  const requester = await prisma.user.findUnique({
    where: { id: accepted.requesterId },
    select: { name: true },
  });
  await Promise.all([
    recordActivity(user.id, "friend.accepted", {
      otherName: requester?.name ?? "",
    }),
    recordActivity(accepted.requesterId, "friend.accepted", {
      otherName: user.name,
    }),
  ]);

  // Quem recebe a notificação é o remetente original do pedido.
  await notifyFriendAccepted(accepted.requesterId, user.name, accepted.id);

  return NextResponse.json({ status: accepted.status });
}

/** DELETE /api/friends/requests/:id — cancelar convite enviado (só o remetente). */
export async function DELETE(_request: Request, context: RouteContext<{ id: string }>) {
  const { user, response } = await requireUser();
  if (response) return response;

  const { id } = await context.params;
  const friendship = await prisma.friendship.findUnique({ where: { id } });
  if (!friendship || friendship.requesterId !== user.id || friendship.status !== "pending") {
    return notFound("Request not found");
  }

  await prisma.friendship.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
