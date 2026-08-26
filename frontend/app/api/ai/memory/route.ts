import { NextResponse } from "next/server";

import { badRequest, requireUser } from "@/lib/server/api";
import { prisma } from "@/lib/server/prisma";

const MAX_FACT_LENGTH = 300;
const MAX_FACTS = 50;

/** GET /api/ai/memory — fatos que a IA lembra sobre o usuário. */
export async function GET() {
  const { user, response } = await requireUser();
  if (response) return response;

  const facts = await prisma.memoryFact.findMany({
    where: { userId: user.id },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    select: { id: true, fact: true, source: true, createdAt: true, updatedAt: true },
  });

  return NextResponse.json(facts);
}

/** POST /api/ai/memory — adiciona fato manual (editável pelo usuário). */
export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;

  let fact = "";
  try {
    const body = (await request.json()) as Record<string, unknown>;
    fact = typeof body.fact === "string" ? body.fact.trim() : "";
  } catch {
    return badRequest("Invalid JSON body");
  }
  if (!fact) return badRequest("Fact is required");
  if (fact.length > MAX_FACT_LENGTH) {
    return NextResponse.json({ error: "Fact too long" }, { status: 400 });
  }

  const count = await prisma.memoryFact.count({ where: { userId: user.id } });
  if (count >= MAX_FACTS) {
    return NextResponse.json(
      { error: `Maximum of ${MAX_FACTS} memories reached` },
      { status: 400 },
    );
  }

  const created = await prisma.memoryFact.create({
    data: { userId: user.id, fact, source: "manual" },
  });

  return NextResponse.json(created, { status: 201 });
}
