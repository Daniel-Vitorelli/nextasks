import { NextResponse } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { periodForFrequency } from "@/lib/server/completions";
import {
  asFrequency,
  badRequest,
  notFound,
  parseTzOffset,
  requireUser,
  type RouteContext,
} from "@/lib/server/api";

export async function POST(
  request: Request,
  { params }: RouteContext<{ id: string }>,
) {
  const { user, response } = await requireUser();
  if (response) return response;

  const { id } = await params;
  const url = new URL(request.url);
  const tzOffsetMinutes = parseTzOffset(url.searchParams.get("tzOffset"));

  const timeBlock = await prisma.timeBlock.findFirst({
    where: { id, routine: { userId: user.id } },
    include: { routine: true },
  });
  if (!timeBlock) {
    return notFound("Time block not found");
  }

  const body = (await request.json().catch(() => ({}))) as { value?: unknown };

  if (typeof body.value !== "string") {
    return badRequest("Value is required");
  }

  let validValue: string;

  if (timeBlock.confirmation === "checklist") {
    if (body.value !== "true" && body.value !== "false") {
      return badRequest("Invalid value for checklist confirmation");
    }
    validValue = body.value;
  } else if (timeBlock.confirmation === "score") {
    const score = Number.parseInt(body.value, 10);
    if (Number.isNaN(score) || score < 1 || score > 10) {
      return badRequest("Invalid value for score confirmation");
    }
    validValue = String(score);
  } else {
    return badRequest("Block has no confirmation mode");
  }

  const period = periodForFrequency(
    asFrequency(timeBlock.routine.frequency),
    new Date(),
    tzOffsetMinutes,
  );

  const completion = await prisma.timeBlockCompletion.upsert({
    where: {
      timeBlockId_periodStart: {
        timeBlockId: timeBlock.id,
        periodStart: period.start,
      },
    },
    create: {
      timeBlockId: timeBlock.id,
      userId: user.id,
      periodStart: period.start,
      periodEnd: period.end,
      value: validValue,
    },
    update: {
      value: validValue,
    },
  });

  return NextResponse.json({ completion, period });
}
