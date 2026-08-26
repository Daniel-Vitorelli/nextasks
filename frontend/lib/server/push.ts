import webpush from "web-push";

import { prisma } from "@/lib/server/prisma";
import {
  achievementName,
  interpolate,
  KIND_GROUP,
  localizedUrl,
  TEMPLATES,
  type NotificationKind,
  type NotifyLocale,
} from "@/lib/notifications/templates";
import { publishRealtimeEvent } from "@/lib/server/notifications/bus";

/** Corpo da notificação entregue ao service worker (public/sw.js). */
export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

const VAPID_SUBJECT = "mailto:support@nextasks.app";

let vapidConfigured: boolean | null = null;

function configureVapid(): boolean {
  if (vapidConfigured !== null) return vapidConfigured;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    console.warn("[push] VAPID keys missing — push notifications disabled.");
    vapidConfigured = false;
    return false;
  }
  webpush.setVapidDetails(VAPID_SUBJECT, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

function isDeadSubscriptionError(error: unknown): boolean {
  if (error && typeof error === "object" && "statusCode" in error) {
    const status = (error as { statusCode?: number }).statusCode;
    return status === 404 || status === 410;
  }
  return false;
}

/**
 * Envia a payload para todas as subscriptions do usuário em paralelo.
 * Subscriptions mortas (404/410 — navegador limpo, chave trocada) são removidas.
 */
async function sendToUserSubscriptions(
  userId: string,
  buildPayload: (locale: NotifyLocale) => PushPayload,
): Promise<void> {
  if (!configureVapid()) return;

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  });
  if (subscriptions.length === 0) return;

  await Promise.allSettled(
    subscriptions.map(async (subscription) => {
      const payload = buildPayload(subscription.locale === "pt" ? "pt" : "en");
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          JSON.stringify(payload),
        );
      } catch (error) {
        if (isDeadSubscriptionError(error)) {
          await prisma.pushSubscription
            .deleteMany({ where: { id: subscription.id } })
            .catch(() => undefined);
          return;
        }
        // Falhas transitórias não derrubam o fluxo da mutação que disparou.
        console.warn("[push] send failed:", error);
      }
    }),
  );
}

/**
 * Ponto de entrada para notificar um usuário:
 * 1. respeita NotificationPreference do grupo do kind;
 * 2. garante unicidade via NotificationLog (unique userId+kind+refKey) —
 *    repetições do mesmo evento são ignoradas;
 * 3. entrega a push formatada no locale de cada subscription.
 *
 * `path` é um caminho interno sem locale ("/app/social") usado no clique.
 */
export async function notifyUser(
  userId: string,
  kind: NotificationKind,
  refKey?: string,
  params?: Record<string, string | number>,
  path = "/app/home",
): Promise<boolean> {
  const group = KIND_GROUP[kind];
  if (group) {
    const preference = await prisma.notificationPreference.findUnique({
      where: { userId },
    });
    if (preference && !preference[group]) return false;
  }

  try {
    await prisma.notificationLog.create({
      data: { userId, kind, refKey: refKey ?? null },
    });
  } catch {
    // Violação de unique → já notificado antes; dedup funcionou.
    return false;
  }

  // Canal em tempo real (app aberto): mesmo dedup/preferências da push.
  publishRealtimeEvent(userId, { id: crypto.randomUUID(), kind, params, path, createdAt: new Date().toISOString() });

  await sendToUserSubscriptions(userId, (locale) => {
    const template = TEMPLATES[kind][locale];
    return {
      title: template.title,
      body: interpolate(template.body, params),
      url: localizedUrl(path, locale),
      tag: `${kind}:${refKey ?? ""}`,
    };
  });

  return true;
}

/**
 * Conveniências tipadas por kind (mantêm os call sites legíveis).
 */

export function notifyFriendRequest(userId: string, requesterName: string, refKey: string) {
  return notifyUser(userId, "friend.request", refKey, { name: requesterName }, "/app/social");
}

export function notifyFriendAccepted(userId: string, accepterName: string, refKey: string) {
  return notifyUser(userId, "friend.accept", refKey, { name: accepterName }, "/app/social");
}

// Conquistas precisam do nome traduzido POR subscription; usamos buildPayload
// customizado em vez dos params fixos de notifyUser.
export async function notifyAchievement(
  userId: string,
  achievementId: string,
  unlockedAtMs: number,
): Promise<boolean> {
  const group = KIND_GROUP["achievement.unlock"];
  const preference = group
    ? await prisma.notificationPreference.findUnique({ where: { userId } })
    : null;
  if (preference && !preference[group!]) return false;

  try {
    await prisma.notificationLog.create({
      data: {
        userId,
        kind: "achievement.unlock",
        refKey: `${achievementId}:${unlockedAtMs}`,
      },
    });
  } catch {
    return false;
  }

  publishRealtimeEvent(userId, {
    id: crypto.randomUUID(),
    kind: "achievement.unlock",
    params: { achievementId },
    path: "/app/gamification",
    createdAt: new Date().toISOString(),
  });

  await sendToUserSubscriptions(userId, (locale) => ({
    title: TEMPLATES["achievement.unlock"][locale].title,
    body: achievementName(locale, achievementId),
    url: localizedUrl("/app/gamification", locale),
    tag: `achievement.unlock:${achievementId}`,
  }));
  return true;
}

export async function notifyLevelUp(userId: string, level: number): Promise<boolean> {
  return notifyUser(userId, "level.up", `level:${level}`, { level }, "/app/gamification");
}

/** Push imediata de teste (ignora preferências; refKey único por chamada). */
export function sendTestPush(userId: string): Promise<boolean> {
  return notifyUser(userId, "test", `test:${Date.now()}`, undefined, "/app/config");
}
