"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  Habit,
  HabitCompleteResponse,
  HabitPayload,
  HabitWithProgress,
} from "@/types/domain";
import {
  notifyDataChanged,
  useDataSync,
  type DataResource,
} from "@/lib/client/data-events";

const AFTER_HABIT_CHANGE: DataResource[] = ["habits"];

function withProgress(
  habit: Habit,
  currentCount = 0,
  isApplicableToday = false,
): HabitWithProgress {
  return { ...habit, currentCount, isApplicableToday };
}

/**
 * Loads and mutates the user's habits with optimistic updates. Each habit
 * carries `currentCount`: confirmações no período atual (hoje/semana).
 */
export function useHabits(tzOffset: number) {
  const [habits, setHabits] = useState<HabitWithProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadHabits = useCallback(async () => {
    try {
      const response = await fetch(`/api/habits?tzOffset=${tzOffset}`);

      if (!response.ok) {
        throw new Error("Failed to load habits");
      }

      setHabits((await response.json()) as HabitWithProgress[]);
    } finally {
      setIsLoading(false);
    }
  }, [tzOffset]);

  useEffect(() => {
    void loadHabits();
  }, [loadHabits]);

  useDataSync(["habits"], loadHabits);

  const saveHabit = useCallback(
    async (values: HabitPayload, habit: Habit | null) => {
      const endpoint = habit ? `/api/habits/${habit.id}` : "/api/habits";
      const method = habit ? "PATCH" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        throw new Error("Failed to save habit");
      }

      const saved = (await response.json()) as Habit;

      setHabits((current) =>
        habit
          ? current.map((item) =>
              item.id === saved.id
                ? withProgress(
                    saved,
                    item.currentCount,
                    item.isApplicableToday,
                  )
                : item,
            )
          : [withProgress(saved), ...current],
      );
      notifyDataChanged(AFTER_HABIT_CHANGE);
    },
    [],
  );

  const deleteHabit = useCallback(async (habit: Habit | null) => {
    if (!habit) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/habits/${habit.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete habit");
      }

      setHabits((current) => current.filter((item) => item.id !== habit.id));
      notifyDataChanged(AFTER_HABIT_CHANGE);
    } catch (error) {
      console.error(error);
    } finally {
      setIsDeleting(false);
    }
  }, []);

  const completeHabit = useCallback(
    async (habitId: string, increment = 1) => {
      const response = await fetch(`/api/habits/${habitId}/complete?tzOffset=${tzOffset}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ increment }),
      });

      if (!response.ok) {
        throw new Error("Failed to complete habit");
      }

      const result = (await response.json()) as HabitCompleteResponse;
      notifyDataChanged(AFTER_HABIT_CHANGE);
      return result;
    },
    [tzOffset],
  );

  return {
    habits,
    isLoading,
    isDeleting,
    saveHabit,
    deleteHabit,
    completeHabit,
  };
}
