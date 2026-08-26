export interface PushSubscriptionPayload {
  endpoint: string;
  p256dh: string;
  auth: string;
  locale: "pt" | "en";
}

type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** Valida o corpo do POST /api/push/subscribe (payload do PushManager). */
export function parsePushSubscribeInput(value: unknown): ParseResult<PushSubscriptionPayload> {
  const body = (value ?? {}) as Record<string, unknown>;
  const keys = (body.keys ?? {}) as Record<string, unknown>;

  const endpoint =
    typeof body.endpoint === "string" && body.endpoint.startsWith("https://")
      ? body.endpoint
      : null;
  const p256dh =
    typeof keys.p256dh === "string" && keys.p256dh.length > 0 ? keys.p256dh : null;
  const auth = typeof keys.auth === "string" && keys.auth.length > 0 ? keys.auth : null;

  if (!endpoint || !p256dh || !auth) {
    return { ok: false, error: "Invalid subscription" };
  }

  return {
    ok: true,
    data: {
      endpoint,
      p256dh,
      auth,
      locale: body.locale === "pt" ? "pt" : "en",
    },
  };
}

const PREFERENCE_FLAGS = [
  "friendEvents",
  "achievements",
  "taskReminders",
  "blockReminders",
  "habitReminders",
] as const;

export type PushPreferencePatch = Partial<Record<(typeof PREFERENCE_FLAGS)[number], boolean>>;

/** Valida o PATCH /api/push/preferences — ao menos uma flag booleana. */
export function parsePushPreferencePatch(value: unknown): ParseResult<PushPreferencePatch> {
  const body = (value ?? {}) as Record<string, unknown>;
  const patch: PushPreferencePatch = {};

  for (const flag of PREFERENCE_FLAGS) {
    if (typeof body[flag] === "boolean") {
      patch[flag] = body[flag] as boolean;
    }
  }

  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "No valid preference flags provided" };
  }
  return { ok: true, data: patch };
}
