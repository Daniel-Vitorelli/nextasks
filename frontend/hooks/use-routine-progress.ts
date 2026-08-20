"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProgressResponse } from "@/types/domain";
import { useDataSync } from "@/lib/client/data-events";
import { useTzOffset } from "@/lib/client/use-tz-offset";

/**
 * Loads the daily progress of the active routine for the given number of days.
 */
export function useRoutineProgress(days: number) {
  const [data, setData] = useState<ProgressResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tzOffsetMinutes = useTzOffset();

  const fetchProgress = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/routines/progress?days=${days}&tzOffset=${tzOffsetMinutes}`,
      );

      if (!response.ok) {
        throw new Error("Failed to load progress");
      }

      setData((await response.json()) as ProgressResponse);
    } catch (error) {
      console.error(error);
      setError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [days, tzOffsetMinutes]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void fetchProgress();
  }, [fetchProgress]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Confirmações de blocos, conexões e rotinas mudam o progresso: recarrega.
  useDataSync(["progress", "time-blocks", "connections", "routines"], () => {
    void fetchProgress();
  });

  return { data, isLoading, error, refetch: fetchProgress };
}
