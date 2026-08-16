import { NextResponse } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { badRequest, notFound, parseTzOffset, requireUser, type RouteContext } from "@/lib/server/api";
import {
  completeEntitiesForBlock,
  connectionInclude,
  loadCompletionsByBlock,
  toConnectionRow,
} from "@/lib/server/connections";
import { parseConnectionPatch } from "@/lib/validation/connections";

export async function PATCH(
  request: Request,
  { params }: RouteContext<{ id: string }>,
) {
  const { user, response } = await requireUser();
  if (response) return response;

  const { id } = await params;

  const existing = await prisma.taskBlockConnection.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) {
    return notFound("Connection not found");
  }

  const patch = parseConnectionPatch(await request.json());
  if (!patch) {
    return badRequest("Invalid connection patch");
  }

  const url = new URL(request.url);
  const tzOffsetMinutes = parseTzOffset(url.searchParams.get("tzOffset"));

  const updated = await prisma.$transaction(async (tx) => {
    const connection = await tx.taskBlockConnection.update({
      where: { id },
      data: patch,
      include: connectionInclude,
    });

    // Ajuste (ex.: requiredCount reduzido) pode satisfazer a conexão agora:
    // propaga a conclusão para a entidade conectada.
    await completeEntitiesForBlock(
      tx,
      user.id,
      existing.timeBlockId,
      tzOffsetMinutes,
    );

    return connection;
  });

  const completionsByBlock = await loadCompletionsByBlock(prisma, [
    updated.timeBlockId,
  ]);

  return NextResponse.json({
    connection: toConnectionRow(
      updated,
      completionsByBlock.get(updated.timeBlockId) ?? [],
      tzOffsetMinutes,
    ),
  });
}

export async function DELETE(
  _request: Request,
  { params }: RouteContext<{ id: string }>,
) {
  const { user, response } = await requireUser();
  if (response) return response;

  const { id } = await params;

  const existing = await prisma.taskBlockConnection.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) {
    return notFound("Connection not found");
  }

  // Remover a conexão não reverte conclusões já propagadas.
  await prisma.taskBlockConnection.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}