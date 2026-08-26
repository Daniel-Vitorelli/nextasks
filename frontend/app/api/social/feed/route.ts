import { NextResponse } from "next/server";

import { requireUser } from "@/lib/server/api";
import { prisma } from "@/lib/server/prisma";
import { loadActivityFeed } from "@/lib/server/social";

/** GET /api/social/feed?limit=30 — atividade recente minha + amigos. */
export async function GET(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;

  const limit = Number.parseInt(
    new URL(request.url).searchParams.get("limit") ?? "30",
    10,
  );

  const items = await loadActivityFeed(prisma, user.id, limit);
  return NextResponse.json({ items });
}
