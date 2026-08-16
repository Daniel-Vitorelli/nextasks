import { NextResponse } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { badRequest, notFound, parseTzOffset, requireUser, type RouteContext } from "@/lib/server/api";
import {
  completeEntitiesForBlock,
  countConfirmedForConnection,
  type ConnectionWithBlock,
} from "@/lib/server/connections";
import { parseConnectionPatch } from "@/lib/validation/connections";
import type { DayFilter, TaskBlockConnection } from "@/types/domain";

const connectionInclude = {
  timeBlock: { include: { routine: true } },
} as const;

async function toConnectionRow(
  connection: ConnectionWithBlock,
  tzOffsetMinutes: number,
): Promise<TaskBlockConnection> {
  return {
    id: connection.id,
    taskId: connection.taskId,
    subtaskId: connection.subtaskId,
    timeBlockId: connection.timeBlockId,
    requiredCount: connection.requiredCount,
    dayFilter: connection.dayFilter as DayFilter,
    confirmedCount: await countConfirmedForConnection(
      prisma,
      connection,
      tzOffsetMinutes,
    ),
  };
}

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
    await completeEntitiesForBlock(tx, user.id, existing.timeBlockId, tzOffsetMinutes);

    return connection;
  });

  return NextResponse.json({
    connection: await toConnectionRow(updated, tzOffsetMinutes),
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