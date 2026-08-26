import { prisma } from "@/lib/server/prisma";

/** Kinds de evento do feed de atividade social. */
export type ActivityKind = "achievement.unlock" | "level.up" | "friend.accepted";

const PRUNE_AFTER_DAYS = 90;

/**
 * Registra um evento no feed de atividade do autor. Falhas nunca derrubam a
 * mutação que o originou. Eventos com mais de 90 dias são podados ao inserir.
 */
export async function recordActivity(
  userId: string,
  kind: ActivityKind,
  data: Record<string, string | number> = {},
): Promise<void> {
  try {
    await prisma.activityEvent.create({
      data: { userId, kind, data: JSON.stringify(data) },
    });
    const cutoff = new Date(Date.now() - PRUNE_AFTER_DAYS * 86_400_000);
    await prisma.activityEvent.deleteMany({
      where: { userId, createdAt: { lt: cutoff } },
    });
  } catch (error) {
    console.warn("[activity] failed to record:", error);
  }
}

/** Parse tolerante do JSON de params de um evento. */
export function parseActivityData(raw: string): Record<string, string | number> {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const entries = Object.entries(parsed as Record<string, unknown>).filter(
      (entry): entry is [string, string | number] =>
        typeof entry[1] === "string" || typeof entry[1] === "number",
    );
    return Object.fromEntries(entries);
  } catch {
    return {};
  }
}
