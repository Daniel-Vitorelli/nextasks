"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChallengesResponse } from "@/types/domain";
import { notifyDataChanged } from "@/lib/client/data-events";

/**
 * Desafios entre amigos: propostas recebidas/enviadas, ativos com progresso
 * ao vivo e histórico. Mutações recarregam a lista e notificam o canal
 * "friends" (mesma aba Social reage).
 */
export function useChallenges() {
  const [data, setData] = useState<ChallengesResponse>({
    incoming: [],
    outgoing: [],
    active: [],
    history: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const inFlight = useRef(new Set<string>());

  const loadChallenges = useCallback(async () => {
    try {
      const response = await fetch("/api/friends/challenges");
      if (!response.ok) throw new Error("Failed to load challenges");
      setData((await response.json()) as ChallengesResponse);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadChallenges();
  }, [loadChallenges]);

  const run = useCallback(
    async (
      key: string,
      action: () => Promise<Response>,
    ): Promise<void> => {
      if (inFlight.current.has(key)) return;
      inFlight.current.add(key);
      try {
        const response = await action();
        if (!response.ok) {
          let message = "";
          try {
            const body = (await response.json()) as { error?: string };
            message = body.error ?? "";
          } catch {
            // corpo sem JSON
          }
          throw new Error(message || `Request failed (${response.status})`);
        }
        await loadChallenges();
        notifyDataChanged(["friends"]);
      } finally {
        inFlight.current.delete(key);
      }
    },
    [loadChallenges],
  );

  const proposeChallenge = useCallback(
    (input: { friendId: string; metric: string; target: number; durationDays: number }) =>
      run(`propose:${input.friendId}:${input.metric}`, () =>
        fetch("/api/friends/challenges", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }),
      ),
    [run],
  );

  const respondToChallenge = useCallback(
    (challengeId: string, action: "accept" | "decline") =>
      run(`respond:${challengeId}:${action}`, () =>
        fetch(`/api/friends/challenges/${challengeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        }),
      ),
    [run],
  );

  const cancelChallenge = useCallback(
    (challengeId: string) =>
      run(`cancel:${challengeId}`, () =>
        fetch(`/api/friends/challenges/${challengeId}`, { method: "DELETE" }),
      ),
    [run],
  );

  return {
    data,
    isLoading,
    proposeChallenge,
    respondToChallenge,
    cancelChallenge,
    reload: loadChallenges,
  };
}

export type UseChallengesReturn = ReturnType<typeof useChallenges>;
