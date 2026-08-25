import { NextResponse } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { requireUser } from "@/lib/server/api";
import {
  buildGamificationSummary,
  evaluateAchievements,
} from "@/lib/server/gamification/service";
import { loadGamificationStats } from "@/lib/server/gamification/stats";
import { parseTzOffset } from "@/lib/server/api";

export async function GET(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;

  const tzOffsetMinutes = parseTzOffset(
    new URL(request.url).searchParams.get("tzOffset"),
  );
  const recentLimit = Number.parseInt(
    new URL(request.url).searchParams.get("recentLimit") ?? "50",
    10,
  );

  // Avalia conquistas dependentes do tempo (streaks que crescem sozinhos).
  await prisma.$transaction(async (tx) => {
    const stats = await loadGamificationStats(tx, user.id, tzOffsetMinutes);
    await evaluateAchievements(tx, user.id, stats);
  });

  const summary = await buildGamificationSummary(prisma, user.id, {
    recentLimit,
  });
  return NextResponse.json(summary);
}
