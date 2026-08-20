import { NextResponse } from "next/server";

import { requireUser } from "@/lib/server/api";
import { buildDataExport } from "@/lib/server/data-transfer";

export async function GET() {
  const { user, response } = await requireUser();
  if (response) return response;

  const payload = await buildDataExport(user.id);
  return NextResponse.json(payload);
}