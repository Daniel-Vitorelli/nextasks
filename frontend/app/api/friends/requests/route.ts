import { NextResponse } from "next/server";

import { recordActivity } from "@/lib/server/activity";
import { badRequest, notFound, requireUser } from "@/lib/server/api";
import { notifyFriendAccepted, notifyFriendRequest } from "@/lib/server/push";
import { prisma } from "@/lib/server/prisma";
import { parseFriendInviteInput } from "@/lib/validation/friends";

export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;

  const payload = parseFriendInviteInput(await request.json());
  if (!payload.ok) return badRequest(payload.error);

  // Destino: por id direto (busca) ou por e-mail (collation MySQL é
  // case-insensitive — acha em qualquer caixa).
  const target = payload.data.userId
    ? await prisma.user.findUnique({
        where: { id: payload.data.userId },
        select: { id: true, name: true },
      })
    : await prisma.user.findUnique({
        where: { email: payload.data.email },
        select: { id: true, name: true },
      });

  if (!target) return notFound("No account found with this email");
  if (target.id === user.id) return badRequest("You cannot befriend yourself");

  // Pedido reverso pendente existente? Aceita automaticamente.
  const reverse = await prisma.friendship.findUnique({
    where: { requesterId_addresseeId: { requesterId: target.id, addresseeId: user.id } },
  });
  if (reverse && reverse.status === "accepted") {
    return badRequest("You are already friends");
  }
  if (reverse && reverse.status === "pending") {
    // O pedido reverso existente é aceito pelo próprio convite.
    const accepted = await prisma.friendship.update({
      where: { id: reverse.id },
      data: { status: "accepted" },
    });
    // O remetente original (target) fica sabendo que o pedido foi aceito.
    await Promise.all([
      recordActivity(user.id, "friend.accepted", {
        otherName: target.name,
      }),
      recordActivity(accepted.requesterId, "friend.accepted", {
        otherName: user.name,
      }),
      notifyFriendAccepted(accepted.requesterId, user.name, accepted.id),
    ]);
    return NextResponse.json({ id: accepted.id, status: accepted.status }, { status: 200 });
  }

  // Já existe pedido meu pendente para o destino?
  const existing = await prisma.friendship.findUnique({
    where: { requesterId_addresseeId: { requesterId: user.id, addresseeId: target.id } },
  });
  if (existing) {
    return badRequest("A request already exists between you");
  }

  const friendship = await prisma.friendship.create({
    data: { requesterId: user.id, addresseeId: target.id, status: "pending" },
  });

  await notifyFriendRequest(target.id, user.name, friendship.id);

  return NextResponse.json({ id: friendship.id, status: friendship.status }, { status: 201 });
}
