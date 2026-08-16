import { NextResponse } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { badRequest, notFound, parseTzOffset, requireUser, type RouteContext } from "@/lib/server/api";
import {
  completeEntitiesForConnections,
  connectionInclude,
  isDayFilterSatisfiable,
  loadCompletionsByBlock,
  toConnectionRow,
} from "@/lib/server/connections";
import { localWeekday } from "@/lib/server/completions";
import { parseConnectionPatch } from "@/lib/validation/connections";
import type { Frequency } from "@/types/domain";

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

  // O dayFilter precisa continuar possível de satisfazer para o bloco.
  if (patch.dayFilter) {
    const block = await prisma.timeBlock.findFirst({
      where: { id: existing.timeBlockId, routine: { userId: user.id } },
      include: { routine: { select: { frequency: true } } },
    });
    if (!block) {
      return notFound("Time block not found");
    }
    const blockWeekday = localWeekday(block.start, tzOffsetMinutes);
    if (
      !isDayFilterSatisfiable(
        patch.dayFilter,
        block.routine.frequency as Frequency,
        blockWeekday,
        tzOffsetMinutes,
      )
    ) {
      return badRequest("Day filter never matches this block");
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const connection = await tx.taskBlockConnection.update({
      where: { id },
      data: patch,
      include: connectionInclude,
    });

    // Ajuste (ex.: requiredCount reduzido) pode satisfazer a conexão agora:
    // propaga a conclusão para a entidade conectada.
    await completeEntitiesForConnections(
      tx,
      user.id,
      [{ taskId: existing.taskId, subtaskId: existing.subtaskId }],
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

  const url = new URL(request.url);
  const tzOffsetMinutes = parseTzOffset(url.searchParams.get("tzOffset"));

  // Remover a conexão não reverte conclusões já propagadas, mas pode ser a
  // última conexão insatisfeita: com as restantes satisfeitas, a entidade
  // completa agora (mesma invariante dos blocos confirmados).
  await prisma.$transaction(async (tx) => {
    await tx.taskBlockConnection.delete({ where: { id } });
    await completeEntitiesForConnections(
      tx,
      user.id,
      [{ taskId: existing.taskId, subtaskId: existing.subtaskId }],
      tzOffsetMinutes,
    );
  });

  return NextResponse.json({ ok: true });
}