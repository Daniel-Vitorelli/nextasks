import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/api";
import { prisma } from "@/lib/server/prisma";

/** GET /api/ai/proposals?conversationId=xxx — lista propostas (pending/accepted/rejected) da conversa ou todas do usuário */
export async function GET(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;

  const url = new URL(request.url);
  const conversationId = url.searchParams.get("conversationId");
  const status = url.searchParams.get("status"); // opcional

  const where: Record<string, unknown> = { userId: user.id };
  if (conversationId) (where as Record<string, string>).conversationId = conversationId;
  if (status && ["pending", "accepted", "rejected", "expired"].includes(status)) (where as Record<string, string>).status = status;

  const proposals = await prisma.aiProposal.findMany({
    where: where as never,
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, conversationId: true, status: true, locale: true, actions: true, createdAt: true, updatedAt: true, expiresAt: true },
  });

  // Marca expiradas lazy
  const now = Date.now();
  for (const p of proposals) {
    if (p.status === "pending" && p.expiresAt && new Date(p.expiresAt).getTime() < now) {
      await prisma.aiProposal.update({ where: { id: p.id }, data: { status: "expired" } }).catch(() => undefined);
      (p as { status: string }).status = "expired";
    }
  }

  return NextResponse.json(proposals);
}
