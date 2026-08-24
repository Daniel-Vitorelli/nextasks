"use client";

import { useCallback, useEffect, useState } from "react";
import type { HabitStats, HabitStatsResponse } from "@/types/domain";
import { useDataSync } from "@/lib/client/data-events";
import { useTzOffset } from "@/lib/client/use-tz-offset";

/**
 * Loads per-habit progress history and streaks. Recarrega junto com o canal
 * "habits": confirmar um hábito atualiza heatmap e streak na hora.
 */
export function useHabitStats(days = 365) {
  const [stats, setStats] = useState<Map<string, HabitStats>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  const tzOffsetMinutes = useTzOffset();

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/habits/stats?days=${days}&tzOffset=${tzOffsetMinutes}`,
      );

      if (!response.ok) {
        throw new Error("Failed to load habit stats");
      }

      const payload = (await response.json()) as HabitStatsResponse;
      setStats(new Map(payload.habits.map((item) => [item.habitId, item])));
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [days, tzOffsetMinutes]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useDataSync(["habits"], () => {
    void fetchStats();
  });

  return { stats, isLoading };
}
