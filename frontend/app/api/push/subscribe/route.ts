import { NextResponse } from "next/server";

import { badRequest, requireUser } from "@/lib/server/api";
import { prisma } from "@/lib/server/prisma";
import { parsePushSubscribeInput } from "@/lib/validation/push";

export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;

  const payload = parsePushSubscribeInput(await request.json());
  if (!payload.ok) {
    return badRequest(payload.error);
  }

  // Upsert por endpoint: o mesmo navegador re-subscribing atualiza as chaves.
  const subscription = await prisma.pushSubscription.upsert({
    where: { endpoint: payload.data.endpoint },
    create: {
      userId: user.id,
      endpoint: payload.data.endpoint,
      p256dh: payload.data.p256dh,
      auth: payload.data.auth,
      locale: payload.data.locale,
      userAgent: request.headers.get("user-agent"),
    },
    update: {
      userId: user.id,
      p256dh: payload.data.p256dh,
      auth: payload.data.auth,
      locale: payload.data.locale,
    },
  });

  return NextResponse.json({ id: subscription.id }, { status: 201 });
}

export async function DELETE(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;

  let endpoint: string | null = null;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    endpoint = typeof body.endpoint === "string" ? body.endpoint : null;
  } catch {
    return badRequest("Endpoint is required");
  }
  if (!endpoint) return badRequest("Endpoint is required");

  await prisma.pushSubscription.deleteMany({
    where: { userId: user.id, endpoint },
  });

  return NextResponse.json({ ok: true });
}
