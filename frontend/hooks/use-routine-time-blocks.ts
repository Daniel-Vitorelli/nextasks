"use client";

import { useCallback, useState } from "react";
import type { CalendarEvent } from "@/types/calendar";
import type { TimeBlock } from "@/types/domain";
import { fromCalendarEvent } from "@/lib/time-blocks";

/**
 * Loads and mutates the time blocks of a routine template with optimistic
 * updates (state changes immediately, API call in the background).
 */
export function useRoutineTimeBlocks(routineId: string | null) {
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const loadBlocks = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/routines/${id}/time-blocks`);

      if (!response.ok) {
        throw new Error("Failed to load time blocks");
      }

      setTimeBlocks((await response.json()) as TimeBlock[]);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createBlock = useCallback(
    async (payload: {
      title: string;
      start: Date;
      end: Date;
      isAllDay: boolean;
      color: "green";
    }) => {
      if (!routineId) return null;

      try {
        const response = await fetch(
          `/api/routines/${routineId}/time-blocks`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
        );

        if (!response.ok) {
          throw new Error("Failed to create time block");
        }

        const saved = (await response.json()) as TimeBlock;
        setTimeBlocks((current) => [...current, saved]);
        setSelectedEventId(saved.id);
        return saved;
      } catch (error) {
        console.error(error);
        return null;
      }
    },
    [routineId],
  );

  const updateBlock = useCallback(
    async (event: CalendarEvent) => {
      if (!routineId) return;

      const previous = timeBlocks;
      setTimeBlocks((current) =>
        current.map((block) =>
          block.id === event.id
            ? {
                ...block,
                title: event.title,
                description: event.description ?? null,
                start: event.start.toISOString(),
                end: event.end.toISOString(),
                isAllDay: event.isAllDay ?? false,
                color: event.color ?? "green",
                confirmation: event.confirmation ?? "none",
              }
            : block,
        ),
      );

      try {
        const response = await fetch(
          `/api/routines/${routineId}/time-blocks/${event.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(fromCalendarEvent(event)),
          },
        );

        if (!response.ok) {
          throw new Error("Failed to update time block");
        }
      } catch (error) {
        console.error(error);
        setTimeBlocks(previous);
      }
    },
    [routineId, timeBlocks],
  );

  const deleteBlock = useCallback(
    async (event: CalendarEvent) => {
      if (!routineId) return;

      const previous = timeBlocks;
      setTimeBlocks((current) => current.filter((b) => b.id !== event.id));
      setSelectedEventId((current) => (current === event.id ? null : current));

      try {
        const response = await fetch(
          `/api/routines/${routineId}/time-blocks/${event.id}`,
          { method: "DELETE" },
        );

        if (!response.ok) {
          throw new Error("Failed to delete time block");
        }
      } catch (error) {
        console.error(error);
        setTimeBlocks(previous);
      }
    },
    [routineId, timeBlocks],
  );

  const duplicateBlock = useCallback(
    async (event: CalendarEvent) => {
      if (!routineId) return;

      try {
        const response = await fetch(
          `/api/routines/${routineId}/time-blocks`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(fromCalendarEvent(event)),
          },
        );

        if (!response.ok) {
          throw new Error("Failed to duplicate time block");
        }

        const saved = (await response.json()) as TimeBlock;
        setTimeBlocks((current) => [...current, saved]);
        setSelectedEventId(saved.id);
      } catch (error) {
        console.error(error);
      }
    },
    [routineId],
  );

  return {
    timeBlocks,
    isLoading,
    selectedEventId,
    loadBlocks,
    createBlock,
    updateBlock,
    deleteBlock,
    duplicateBlock,
    setSelectedEventId,
  };
}
