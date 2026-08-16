"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProgressResponse } from "@/types/domain";

/**
 * Loads the daily progress of the active routine for the given number of days.
 */
export function useRoutineProgress(days: number) {
  const [data, setData] = useState<ProgressResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProgress = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const tzOffsetMinutes = new Date().getTimezoneOffset();
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
  }, [days]);

  useEffect(() => {
    void fetchProgress();
  }, [fetchProgress]);

  return { data, isLoading, error, refetch: fetchProgress };
}
