import { NextResponse } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { badRequest, notFound, requireUser } from "@/lib/server/api";
import { parseUserPatch } from "@/lib/validation/user";

export async function GET() {
  const { user, response } = await requireUser();
  if (response) return response;

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
  });
  if (!profile) {
    return notFound("User not found");
  }
  return NextResponse.json(profile);
}

export async function PATCH(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;

  const patch = parseUserPatch(await request.json());
  if (!patch) {
    return badRequest("Invalid user payload");
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: patch,
  });
  return NextResponse.json(updated);
}