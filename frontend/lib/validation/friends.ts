export type FriendRequestAction = "accept" | "decline";

type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface FriendInviteInput {
  /** Convite direto por id (vem da busca por nome). */
  userId?: string;
  /** Convite por e-mail (fluxo clássico). */
  email?: string;
}

/**
 * Valida o corpo do POST /api/friends/requests — aceita userId OU email
 * (pelo menos um dos dois deve vir válido).
 */
export function parseFriendInviteInput(value: unknown): ParseResult<FriendInviteInput> {
  const body = (value ?? {}) as Record<string, unknown>;

  const userId =
    typeof body.userId === "string" && body.userId.trim().length > 0
      ? body.userId.trim()
      : null;
  if (userId) return { ok: true, data: { userId } };

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (email && EMAIL_RE.test(email)) {
    return { ok: true, data: { email } };
  }

  return { ok: false, error: "A valid email or userId is required" };
}

/** Valida o PATCH /api/friends/requests/:id. */
export function parseFriendRequestAction(value: unknown): ParseResult<FriendRequestAction> {
  const body = (value ?? {}) as Record<string, unknown>;
  if (body.action === "accept" || body.action === "decline") {
    return { ok: true, data: body.action };
  }
  return { ok: false, error: 'Action must be "accept" or "decline"' };
}
