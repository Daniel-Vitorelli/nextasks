import enMessages from "@/messages/en.json";
import ptMessages from "@/messages/pt.json";

/** Idiomas suportados nas pushes (mesmo conjunto do next-intl). */
export type NotifyLocale = "en" | "pt";

/**
 * Kinds de notificação. Grupos mapeiam para as flags de
 * NotificationPreference (null = sempre enviada, ex.: teste).
 */
export type NotificationKind =
  | "friend.request"
  | "friend.accept"
  | "achievement.unlock"
  | "level.up"
  | "task.due.today"
  | "task.overdue"
  | "block.starting"
  | "routine.day.incomplete"
  | "habit.streak.atRisk"
  | "test";

type PreferenceGroup =
  | "friendEvents"
  | "achievements"
  | "taskReminders"
  | "blockReminders"
  | "habitReminders";

export const KIND_GROUP: Record<NotificationKind, PreferenceGroup | null> = {
  "friend.request": "friendEvents",
  "friend.accept": "friendEvents",
  "achievement.unlock": "achievements",
  "level.up": "achievements",
  "task.due.today": "taskReminders",
  "task.overdue": "taskReminders",
  "block.starting": "blockReminders",
  "routine.day.incomplete": "blockReminders",
  "habit.streak.atRisk": "habitReminders",
  test: null,
};

interface Template {
  title: string;
  body: string;
}

/**
 * Templates por kind e locale. Placeholders no formato "{nome}" são
 * substituídos pelos params informados em notifyUser().
 */
export const TEMPLATES: Record<NotificationKind, Record<NotifyLocale, Template>> = {
  "friend.request": {
    pt: { title: "Nova solicitação de amizade", body: "{name} quer ser seu amigo(a)." },
    en: { title: "New friend request", body: "{name} wants to be your friend." },
  },
  "friend.accept": {
    pt: { title: "Solicitação aceita", body: "{name} aceitou seu pedido de amizade." },
    en: { title: "Request accepted", body: "{name} accepted your friend request." },
  },
  "achievement.unlock": {
    pt: { title: "Conquista desbloqueada!", body: "{name}" },
    en: { title: "Achievement unlocked!", body: "{name}" },
  },
  "level.up": {
    pt: { title: "Você subiu de nível!", body: "Agora você está no nível {level}." },
    en: { title: "Level up!", body: "You are now level {level}." },
  },
  "task.due.today": {
    pt: { title: "Tarefa vence hoje", body: '"{title}" vence hoje.' },
    en: { title: "Task due today", body: '"{title}" is due today.' },
  },
  "task.overdue": {
    pt: { title: "Tarefa atrasada", body: '"{title}" passou do prazo.' },
    en: { title: "Overdue task", body: '"{title}" is past its due date.' },
  },
  "block.starting": {
    pt: { title: "Bloco começando", body: '"{title}" começa em cerca de {minutes} min.' },
    en: { title: "Block starting soon", body: '"{title}" starts in about {minutes} min.' },
  },
  "routine.day.incomplete": {
    pt: {
      title: "Dia quase terminando",
      body: "Seu dia ainda não está 100% — falta(m) {remaining} bloco(s).",
    },
    en: {
      title: "Day is almost over",
      body: "Your day is not 100% yet — {remaining} block(s) left.",
    },
  },
  "habit.streak.atRisk": {
    pt: {
      title: "Streak em risco",
      body: "{count} hábito(s) ainda sem meta batida hoje.",
    },
    en: {
      title: "Streak at risk",
      body: "{count} habit(s) still below today's target.",
    },
  },
  test: {
    pt: { title: "Notificação de teste", body: "Se você leu isso, as pushes estão funcionando!" },
    en: { title: "Test notification", body: "If you can read this, push is working!" },
  },
};

const MESSAGE_TREES: Record<NotifyLocale, Record<string, unknown>> = {
  en: enMessages as unknown as Record<string, unknown>,
  pt: ptMessages as unknown as Record<string, unknown>,
};

/** Resolve uma chave pontilhada nos arquivos de mensagens (ex.: "app.x.y"). */
function lookupMessage(locale: NotifyLocale, key: string): string | null {
  let node: unknown = MESSAGE_TREES[locale];
  for (const part of key.split(".")) {
    if (!node || typeof node !== "object") return null;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : null;
}

/** Nome traduzido de uma conquista do catálogo de gamificação. */
export function achievementName(locale: NotifyLocale, achievementId: string): string {
  const name = lookupMessage(
    locale,
    `app.gamification.achievements.${achievementId}.name`,
  );
  return name ?? achievementId;
}

/** Substitui placeholders "{chave}" pelos valores informados. */
export function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match,
  );
}

/** Prefixa o locale em um caminho interno ("/app/social" → "/pt/app/social"). */
export function localizedUrl(path: string, locale: NotifyLocale): string {
  return `/${locale}${path}`;
}
