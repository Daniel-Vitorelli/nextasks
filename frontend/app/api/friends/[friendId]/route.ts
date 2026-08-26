import { NextResponse } from "next/server";

import { notFound, requireUser, RouteContext } from "@/lib/server/api";
import { loadFriendDetail } from "@/lib/server/public-profile";
import { prisma } from "@/lib/server/prisma";

/**
 * GET /api/friends/:friendId — detalhe público de um amigo aceito
 * (perfil + recorte leve das estatísticas de gamificação).
 */
export async function GET(_request: Request, context: RouteContext<{ friendId: string }>) {
  const { user, response } = await requireUser();
  if (response) return response;

  const { friendId } = await context.params;

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

  const detail = await loadFriendDetail(prisma, friendId);
  if (!detail) return notFound("Friend not found");

  return NextResponse.json(detail);
}

/** DELETE — desfazer amizade em qualquer direção. */
export async function DELETE(_request: Request, context: RouteContext<{ friendId: string }>) {
  const { user, response } = await requireUser();
  if (response) return response;

  const { friendId } = await context.params;

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

  await prisma.friendship.delete({ where: { id: friendship.id } });

  return NextResponse.json({ ok: true });
}
