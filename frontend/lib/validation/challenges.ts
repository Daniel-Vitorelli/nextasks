export const CHALLENGE_METRICS = ["xp", "blocks", "tasks", "habits"] as const;
export type ChallengeMetric = (typeof CHALLENGE_METRICS)[number];

export const CHALLENGE_DURATIONS = [3, 7, 14] as const;
export type ChallengeDurationDays = (typeof CHALLENGE_DURATIONS)[number];

/** Limites de meta por métrica (evita metas absurdas/inválidas). */
const TARGET_BOUNDS: Record<ChallengeMetric, { min: number; max: number }> = {
  xp: { min: 50, max: 100_000 },
  blocks: { min: 1, max: 500 },
  tasks: { min: 1, max: 500 },
  habits: { min: 1, max: 500 },
};

type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface ChallengeInput {
  friendId: string;
  metric: ChallengeMetric;
  target: number;
  durationDays: ChallengeDurationDays;
}

/** Valida o corpo do POST /api/friends/challenges. */
export function parseChallengeInput(value: unknown): ParseResult<ChallengeInput> {
  const body = (value ?? {}) as Record<string, unknown>;

  const friendId =
    typeof body.friendId === "string" && body.friendId.trim().length > 0
      ? body.friendId.trim()
      : null;
  if (!friendId) return { ok: false, error: "friendId is required" };

  const metric = CHALLENGE_METRICS.find((candidate) => candidate === body.metric);
  if (!metric) {
    return { ok: false, error: `metric must be one of: ${CHALLENGE_METRICS.join(", ")}` };
  }

  const target =
    typeof body.target === "number" && Number.isFinite(body.target)
      ? Math.floor(body.target)
      : NaN;
  const bounds = TARGET_BOUNDS[metric];
  if (!Number.isFinite(target) || target < bounds.min || target > bounds.max) {
    return {
      ok: false,
      error: `target for "${metric}" must be between ${bounds.min} and ${bounds.max}`,
    };
  }

  const durationDays = CHALLENGE_DURATIONS.find(
    (candidate) => candidate === body.durationDays,
  );
  if (!durationDays) {
    return {
      ok: false,
      error: `durationDays must be one of: ${CHALLENGE_DURATIONS.join(", ")}`,
    };
  }

  return { ok: true, data: { friendId, metric, target, durationDays } };
}

export type ChallengeAction = "accept" | "decline";

/** Valida o PATCH /api/friends/challenges/:id. */
export function parseChallengeAction(value: unknown): ParseResult<ChallengeAction> {
  const body = (value ?? {}) as Record<string, unknown>;
  if (body.action === "accept" || body.action === "decline") {
    return { ok: true, data: body.action };
  }
  return { ok: false, error: 'action must be "accept" or "decline"' };
}
