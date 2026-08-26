import { NextResponse } from "next/server";

import { requireUser } from "@/lib/server/api";
import { prisma } from "@/lib/server/prisma";

/** GET /api/ai/conversations — lista de conversas do usuário (sidebar). */
export async function GET() {
  const { user, response } = await requireUser();
  if (response) return response;

  const conversations = await prisma.chatConversation.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { messages: true } },
    },
  });

  return NextResponse.json(
    conversations.map(({ _count, ...conversation }) => ({
      ...conversation,
      messageCount: _count.messages,
    })),
  );
}
