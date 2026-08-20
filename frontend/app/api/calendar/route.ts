import { NextResponse } from "next/server";

import { badRequest, parseTzOffset, requireUser } from "@/lib/server/api";
import { materializeSchedule } from "@/lib/server/schedule";

const MAX_RANGE_DAYS = 62;

export async function GET(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;

  const url = new URL(request.url);
  const tzOffsetMinutes = parseTzOffset(url.searchParams.get("tzOffset"));
  const startValue = url.searchParams.get("start");
  const endValue = url.searchParams.get("end");

  const start = startValue ? new Date(startValue) : null;
  const end = endValue ? new Date(endValue) : null;
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return badRequest("Invalid start/end");
  }
  if (end.getTime() < start.getTime()) {
    return badRequest("end must be after start");
  }
  if (end.getTime() - start.getTime() > MAX_RANGE_DAYS * 86_400_000) {
    return badRequest("Range too large");
  }

  const occurrences = await materializeSchedule(
    user.id,
    start,
    end,
    tzOffsetMinutes,
  );

  return NextResponse.json({ occurrences });
}