import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/session";
import { periodForFrequency } from "@/lib/completions";

const unauthorized = () =>
  NextResponse.json({ error: "Unauthorized" }, { status: 401 });

const notFound = () =>
  NextResponse.json({ error: "Time block not found" }, { status: 404 });

interface RouteContext {
  params: Promise<{ id: string }>;
}

function parseTzOffset(value: string | null): number {
  const offset = Number.parseInt(value ?? "0", 10);
  return Number.isFinite(offset) ? offset : 0;
}

export async function POST(request: Request, { params }: RouteContext) {
  const user = await getUser();

  if (!user) {
    return unauthorized();
  }

  const { id } = await params;
  const url = new URL(request.url);
  const tzOffsetMinutes = parseTzOffset(url.searchParams.get("tzOffset"));

  const timeBlock = await prisma.timeBlock.findFirst({
    where: { id, routine: { userId: user.id } },
    include: { routine: true },
  });

  if (!timeBlock) {
    return notFound();
  }

  const body = (await request.json().catch(() => ({}))) as { value?: unknown };

  if (typeof body.value !== "string") {
    return NextResponse.json(
      { error: "Value is required" },
      { status: 400 },
    );
  }

  let validValue: string;

  if (timeBlock.confirmation === "checklist") {
    if (body.value !== "true" && body.value !== "false") {
      return NextResponse.json(
        { error: "Invalid value for checklist confirmation" },
        { status: 400 },
      );
    }
    validValue = body.value;
  } else if (timeBlock.confirmation === "score") {
    const score = Number.parseInt(body.value, 10);
    if (Number.isNaN(score) || score < 1 || score > 10) {
      return NextResponse.json(
        { error: "Invalid value for score confirmation" },
        { status: 400 },
      );
    }
    validValue = String(score);
  } else {
    return NextResponse.json(
      { error: "Block has no confirmation mode" },
      { status: 400 },
    );
  }

  const period = periodForFrequency(
    timeBlock.routine.frequency as "daily" | "weekly",
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
