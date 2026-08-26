import { NextResponse } from "next/server";

import { notFound, requireUser, RouteContext } from "@/lib/server/api";
import { prisma } from "@/lib/server/prisma";

async function getOwnedConversation(id: string, userId: string) {
  return prisma.chatConversation.findFirst({
    where: { id, userId },
  });
}

/** GET — mensagens da conversa. */
export async function GET(_request: Request, context: RouteContext<{ id: string }>) {
  const { user, response } = await requireUser();
  if (response) return response;

  const { id } = await context.params;
  const conversation = await getOwnedConversation(id, user.id);
  if (!conversation) return notFound("Conversation not found");

  const messages = await prisma.chatMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, role: true, content: true, createdAt: true },
  });

  return NextResponse.json({
    id: conversation.id,
    title: conversation.title,
    messages,
  });
}

/** DELETE — excluir conversa (mensagens em cascata). */
export async function DELETE(_request: Request, context: RouteContext<{ id: string }>) {
  const { user, response } = await requireUser();
  if (response) return response;

  const { id } = await context.params;
  const conversation = await getOwnedConversation(id, user.id);
  if (!conversation) return notFound("Conversation not found");

  await prisma.chatConversation.delete({ where: { id: conversation.id } });
  return NextResponse.json({ ok: true });
}
