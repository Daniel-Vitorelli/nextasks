import { NextResponse } from "next/server";
import { notFound, requireUser, type RouteContext } from "@/lib/server/api";
import { prisma } from "@/lib/server/prisma";

export async function POST(_request: Request, context: RouteContext<{ id: string }>) {
  const { user, response } = await requireUser();
  if (response) return response;

  const { id } = await context.params;
  const proposal = await prisma.aiProposal.findFirst({ where: { id, userId: user.id } });
  if (!proposal) return notFound("Proposal not found");
  if (proposal.status !== "pending") {
    return NextResponse.json({ error: `Proposal already ${proposal.status}` }, { status: 409 });
  }

  await prisma.aiProposal.update({ where: { id }, data: { status: "rejected" } });
  return NextResponse.json({ ok: true });
}
