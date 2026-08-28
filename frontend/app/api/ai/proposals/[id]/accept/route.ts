import { NextResponse } from "next/server";
import { notFound, requireUser, type RouteContext } from "@/lib/server/api";
import { prisma } from "@/lib/server/prisma";
import { executeProposalAction, type ProposalAction } from "@/lib/server/ai/tools";

export async function POST(_request: Request, context: RouteContext<{ id: string }>) {
  const { user, response } = await requireUser();
  if (response) return response;

  const { id } = await context.params;
  const proposal = await prisma.aiProposal.findFirst({ where: { id, userId: user.id } });
  if (!proposal) return notFound("Proposal not found");
  if (proposal.status !== "pending") {
    return NextResponse.json({ error: `Proposal already ${proposal.status}` }, { status: 409 });
  }
  if (proposal.expiresAt && new Date(proposal.expiresAt).getTime() < Date.now()) {
    await prisma.aiProposal.update({ where: { id }, data: { status: "expired" } });
    return NextResponse.json({ error: "Proposal expired" }, { status: 410 });
  }

  const url = new URL(_request.url);
  const tzOffsetMinutes = Number.parseInt(url.searchParams.get("tzOffset") ?? "0", 10) || 0;
  const rawActions = proposal.actions as unknown as ProposalAction[];
  if (!Array.isArray(rawActions) || rawActions.length === 0) {
    return NextResponse.json({ error: "No actions" }, { status: 400 });
  }

  // Executa todas as ações em uma transação
  try {
    const applied = await prisma.$transaction(async (tx) => {
      const results: string[] = [];
      for (const action of rawActions) {
        await executeProposalAction(tx, user.id, action, tzOffsetMinutes);
        results.push(action.id);
      }
      await tx.aiProposal.update({ where: { id }, data: { status: "accepted" } });
      return results;
    });

    return NextResponse.json({ ok: true, applied });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to apply";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
