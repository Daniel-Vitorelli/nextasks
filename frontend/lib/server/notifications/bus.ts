import type { NotificationKind } from "@/lib/notifications/templates";

/**
 * Barramento in-memory de eventos em tempo real por usuário.
 *
 * Alimenta o canal SSE (/api/notifications/stream) para que o app ABERTO
 * reaja na hora (toast + refresh dos dados). Com o site FECHADO, a entrega
 * continua por conta do Web Push — os dois canais são disparados juntos
 * dentro de notifyUser(), com o mesmo dedup via NotificationLog.
 *
 * Escopo: um processo = um barramento (deploy atual é single-container).
 */

export interface RealtimeEvent {
  id: string;
  kind: NotificationKind;
  params?: Record<string, string | number>;
  /** Caminho interno sem locale ("/app/social") para navegação no clique. */
  path: string;
  createdAt: string;
}

type Listener = (event: RealtimeEvent) => void;

interface BusGlobal {
  __nextasksRealtimeBus?: Map<string, Set<Listener>>;
}

const globalScope = globalThis as typeof globalThis & BusGlobal;

function getBus(): Map<string, Set<Listener>> {
  if (!globalScope.__nextasksRealtimeBus) {
    globalScope.__nextasksRealtimeBus = new Map();
  }
  return globalScope.__nextasksRealtimeBus;
}

/** Registra um listener para os eventos do usuário; devolve o unsubscribe. */
export function subscribeToUserEvents(userId: string, listener: Listener): () => void {
  const bus = getBus();
  const set = bus.get(userId) ?? new Set<Listener>();
  set.add(listener);
  bus.set(userId, set);
  return () => {
    const current = bus.get(userId);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) bus.delete(userId);
  };
}

/** Entrega o evento a todos os listeners conectados do usuário. */
export function publishRealtimeEvent(userId: string, event: RealtimeEvent): void {
  const set = getBus().get(userId);
  if (!set || set.size === 0) return;
  for (const listener of [...set]) {
    try {
      listener(event);
    } catch {
      // Listener morto não derruba os demais; o SSE limpa na desconexão.
    }
  }
}
