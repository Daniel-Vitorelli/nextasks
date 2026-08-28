"use client";

import { useEffect, useRef } from "react";

import {
  notifyDataChanged,
  type DataResource,
} from "@/lib/client/data-events";
import type { NotificationKind } from "@/lib/notifications/templates";

export interface RealtimeNotification {
  id: string;
  kind: NotificationKind;
  params?: Record<string, string | number>;
  path: string;
  createdAt: string;
}

/** Canais de dados que cada kind deve recarregar no app aberto. */
const CHANNELS_BY_KIND: Record<NotificationKind, DataResource[]> = {
  "friend.request": ["friends"],
  "friend.accept": ["friends"],
  "achievement.unlock": ["gamification"],
  "level.up": ["gamification"],
  "challenge.received": ["friends"],
  "challenge.accepted": ["friends"],
  "challenge.finished": ["friends", "gamification"],
  "task.due.today": ["tasks"],
  "task.overdue": ["tasks"],
  "block.starting": ["current-block", "time-blocks", "progress"],
  "routine.day.incomplete": ["current-block", "progress"],
  "habit.streak.atRisk": ["habits"],
  test: [],
};

/**
 * Consome /api/notifications/stream (SSE): para cada evento refresca os
 * canais de dados afetados e entrega o evento ao callback (toast in-app) —
 * a UI reage na hora, sem refresh. Com o site fechado, a entrega fica por
 * conta do Web Push.
 */
export function useNotificationStream(
  onNotification: (notification: RealtimeNotification) => void,
) {
  const onNotificationRef = useRef(onNotification);

  // Sempre executa a versão mais recente do callback.
  useEffect(() => {
    onNotificationRef.current = onNotification;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !("EventSource" in window)) return;

    const source = new EventSource("/api/notifications/stream");

    source.addEventListener("notification", (rawEvent) => {
      try {
        const event = JSON.parse(
          (rawEvent as MessageEvent<string>).data,
        ) as RealtimeNotification;

        notifyDataChanged(CHANNELS_BY_KIND[event.kind] ?? []);
        onNotificationRef.current(event);
      } catch {
        // payload inválido: ignora
      }
    });

    return () => {
      source.close();
    };
  }, []);
}
