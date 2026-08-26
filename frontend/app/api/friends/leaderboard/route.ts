import { NextResponse } from "next/server";

import { parseTzOffset, requireUser } from "@/lib/server/api";
import { prisma } from "@/lib/server/prisma";
import { loadWeeklyLeaderboard } from "@/lib/server/social";

/** GET /api/friends/leaderboard?tzOffset= — XP da semana (eu + amigos). */
export async function GET(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;

  const tzOffsetMinutes = parseTzOffset(
    new URL(request.url).searchParams.get("tzOffset"),
  );

  const entries = await loadWeeklyLeaderboard(prisma, user.id, tzOffsetMinutes);
  return NextResponse.json({ entries });
}
