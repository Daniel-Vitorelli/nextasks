import { NextResponse } from "next/server";

import { notFound, requireUser, RouteContext } from "@/lib/server/api";
import { prisma } from "@/lib/server/prisma";

/** DELETE /api/ai/memory/:factId — esquecer um fato. */
export async function DELETE(_request: Request, context: RouteContext<{ factId: string }>) {
  const { user, response } = await requireUser();
  if (response) return response;

  const { factId } = await context.params;
  const fact = await prisma.memoryFact.findFirst({
    where: { id: factId, userId: user.id },
    select: { id: true },
  });
  if (!fact) return notFound("Memory not found");

  await prisma.memoryFact.delete({ where: { id: fact.id } });
  return NextResponse.json({ ok: true });
}
