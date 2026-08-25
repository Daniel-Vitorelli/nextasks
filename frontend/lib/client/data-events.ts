"use client";

import { useEffect, useEffectEvent } from "react";

/**
 * Barramento de eventos de dados (cliente). Substitui o evento global único
 * por canais tipados: cada hook de dados registra seu recarregamento nos
 * canais que lhe interessam e cada mutação notifica os canais afetados,
 * mantendo todas as telas sincronizadas sem dependência de estado global.
 */

export type DataResource =
  | "tasks"
  | "subtasks"
  | "connections"
  | "routines"
  | "time-blocks"
  | "progress"
  | "current-block"
  | "habits"
  | "gamification";

const listeners = new Map<DataResource, Set<() => void>>();

function subscribe(resource: DataResource, callback: () => void): () => void {
  let set = listeners.get(resource);
  if (!set) {
    set = new Set();
    listeners.set(resource, set);
  }
  set.add(callback);
  return () => {
    set.delete(callback);
    if (set.size === 0) listeners.delete(resource);
  };
}

/** Notifica os canais informados (recarrega quem estiver registrado neles). */
export function notifyDataChanged(resources: DataResource[]): void {
  for (const resource of resources) {
    const set = listeners.get(resource);
    if (!set) continue;
    // Copia o conjunto: um callback pode desregistrar-se durante a iteração.
    for (const callback of [...set]) {
      callback();
    }
  }
}

/**
 * Registra o recarregamento do hook nos canais informados, sempre chamando a
 * versão mais recente do callback (via Effect Event) e desregistrando no
 * unmount.
 */
export function useDataSync(
  resources: DataResource[],
  onDataChanged: () => void,
): void {
  const onDataChangedEvent = useEffectEvent(onDataChanged);

  useEffect(() => {
    const unsubscribes = resources.map((resource) =>
      subscribe(resource, () => onDataChangedEvent()),
    );
    return () => {
      for (const unsubscribe of unsubscribes) unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resources.join(",")]);
}