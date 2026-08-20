import { NextResponse } from "next/server";

import { badRequest, requireUser } from "@/lib/server/api";
import { importDataExport } from "@/lib/server/data-transfer";
import { parseDataExport } from "@/lib/validation/data-transfer";

export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;

  const payload = parseDataExport(await request.json());
  if (!payload) {
    return badRequest("Invalid export payload");
  }

  const result = await importDataExport(user.id, payload);
  return NextResponse.json(result);
}