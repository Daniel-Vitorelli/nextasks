import { NextResponse } from "next/server";

import type { Frequency } from "@/types/domain";
import { getUser } from "@/lib/session";

/** Route context for dynamic segments (params arrive as a Promise in Next 15+) */
export interface RouteContext<T extends Record<string, string> = Record<string, string>> {
  params: Promise<T>;
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function notFound(message = "Not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

/** Returns the authenticated user or responds with 401 (null on failure). */
export async function requireUser() {
  const user = await getUser();
  if (!user) {
    return { user: null, response: unauthorized() } as const;
  }
  return { user, response: null } as const;
}

/** Parses the ?tzOffset= query param, defaulting to 0 when missing/invalid. */
export function parseTzOffset(value: string | null): number {
  const offset = Number.parseInt(value ?? "0", 10);
  return Number.isFinite(offset) ? offset : 0;
}

/** Validates a routine frequency string (falls back to "daily"). */
export function asFrequency(value: string): Frequency {
  return value === "weekly" ? "weekly" : "daily";
}
