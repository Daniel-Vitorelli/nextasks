"use client";

import { useCallback, useEffect, useState } from "react";
import type { GamificationSummary } from "@/types/domain";
import { useDataSync } from "@/lib/client/data-events";
import { useTzOffset } from "@/lib/client/use-tz-offset";

/**
 * Carrega o resumo de gamificação e recarrega sempre que qualquer fonte de
 * XP muda (blocos, tarefas, sub-tarefas, hábitos).
 */
export function useGamification() {
  const [summary, setSummary] = useState<GamificationSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const tzOffset = useTzOffset();

  const load = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/gamification?tzOffset=${tzOffset}`,
      );
      if (!response.ok) throw new Error("Failed to load gamification");
      setSummary((await response.json()) as GamificationSummary);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [tzOffset]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void load();
  }, [load]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useDataSync(
    ["gamification", "habits", "tasks", "subtasks", "time-blocks"],
    () => void load(),
  );

  return { summary, isLoading, reload: load };
}
