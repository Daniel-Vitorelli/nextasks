import { NextResponse } from "next/server";

import { requireUser } from "@/lib/server/api";
import { sendTestPush } from "@/lib/server/push";

export async function POST() {
  const { user, response } = await requireUser();
  if (response) return response;

  await sendTestPush(user.id);
  return NextResponse.json({ ok: true });
}
