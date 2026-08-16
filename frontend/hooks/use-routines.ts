"use client";

import { useCallback, useEffect, useState } from "react";
import type { Routine, RoutineFormValues } from "@/types/domain";

/**
 * Loads and mutates the user's routines with optimistic updates.
 * The active routine is kept pinned at the top of the list.
 */
export function useRoutines() {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadRoutines = useCallback(async () => {
    try {
      const response = await fetch("/api/routines");

      if (!response.ok) {
        throw new Error("Failed to load routines");
      }

      setRoutines((await response.json()) as Routine[]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRoutines();
  }, [loadRoutines]);

  const saveRoutine = useCallback(
    async (values: RoutineFormValues, routine: Routine | null) => {
      const endpoint = routine
        ? `/api/routines/${routine.id}`
        : "/api/routines";
      const method = routine ? "PATCH" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        throw new Error("Failed to save routine");
      }

      const saved = (await response.json()) as Routine;

      setRoutines((current) =>
        routine
          ? current.map((item) => (item.id === saved.id ? saved : item))
          : [saved, ...current],
      );
    },
    [],
  );

  const duplicateRoutine = useCallback(
    async (routine: Routine, duplicateSuffix: string) => {
      try {
        const response = await fetch(`/api/routines/${routine.id}/duplicate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: `${routine.name} (${duplicateSuffix})`,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to duplicate routine");
        }

        const copy = (await response.json()) as Routine;
        setRoutines((current) => {
          // Insert the copy right after the active routine (or at the top),
          // keeping the active one pinned first.
          const activeIndex = current.findIndex((item) => item.isActive);
          const insertAt = activeIndex === -1 ? 0 : activeIndex + 1;
          return [
            ...current.slice(0, insertAt),
            copy,
            ...current.slice(insertAt),
          ];
        });
      } catch (error) {
        console.error(error);
      }
    },
    [],
  );

  const toggleActiveRoutine = useCallback(async (routine: Routine) => {
    try {
      const response = await fetch(`/api/routines/${routine.id}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !routine.isActive }),
      });

      if (!response.ok) {
        throw new Error("Failed to update active routine");
      }

      const saved = (await response.json()) as Routine;

      setRoutines((current) => {
        const updated = current.map((item) =>
          item.id === saved.id
            ? saved
            : saved.isActive && item.isActive
              ? { ...item, isActive: false }
              : item,
        );

        // Keep the active routine pinned at the top of the list.
        if (!saved.isActive) {
          return updated;
        }
        return [saved, ...updated.filter((item) => item.id !== saved.id)];
      });
    } catch (error) {
      console.error(error);
    }
  }, []);

  const deleteRoutine = useCallback(async (routine: Routine | null) => {
    if (!routine) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/routines/${routine.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete routine");
      }

      setRoutines((current) =>
        current.filter((item) => item.id !== routine.id),
      );
    } catch (error) {
      console.error(error);
    } finally {
      setIsDeleting(false);
    }
  }, []);

  return {
    routines,
    isLoading,
    isDeleting,
    saveRoutine,
    duplicateRoutine,
    toggleActiveRoutine,
    deleteRoutine,
  };
}
