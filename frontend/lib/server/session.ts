import { headers } from "next/headers";

import { auth } from "@/lib/server/auth";

export async function getUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session?.user ?? null;
}