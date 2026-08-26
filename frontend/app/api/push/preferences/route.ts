import { NextResponse } from "next/server";

import { badRequest, requireUser } from "@/lib/server/api";
import { prisma } from "@/lib/server/prisma";
import { parsePushPreferencePatch } from "@/lib/validation/push";

const DEFAULT_PREFERENCES = {
  friendEvents: true,
  achievements: true,
  taskReminders: true,
  blockReminders: true,
  habitReminders: true,
};

export async function GET() {
  const { user, response } = await requireUser();
  if (response) return response;

  const preferences = await prisma.notificationPreference.findUnique({
    where: { userId: user.id },
  });

  // Linha ausente = defaults ligados.
  return NextResponse.json(preferences ?? { userId: user.id, ...DEFAULT_PREFERENCES });
}

export async function PATCH(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;

  const payload = parsePushPreferencePatch(await request.json());
  if (!payload.ok) return badRequest(payload.error);

  const preferences = await prisma.notificationPreference.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...DEFAULT_PREFERENCES, ...payload.data },
    update: payload.data,
  });

  return NextResponse.json(preferences);
}
