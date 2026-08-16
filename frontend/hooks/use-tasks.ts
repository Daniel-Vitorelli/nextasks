"use client";

import { useCallback, useEffect, useState } from "react";
import type { Task, TaskFormValues } from "@/types/domain";
import { sortTasksForList } from "@/lib/task-ordering";

/**
 * Loads and mutates the user's tasks with optimistic updates.
 */
export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadTasks = useCallback(async () => {
    try {
      const response = await fetch("/api/tasks");

      if (!response.ok) {
        throw new Error("Failed to load tasks");
      }

      setTasks((await response.json()) as Task[]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const saveTask = useCallback(
    async (values: TaskFormValues, task: Task | null) => {
      const endpoint = task ? `/api/tasks/${task.id}` : "/api/tasks";
      const method = task ? "PATCH" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        throw new Error("Failed to save task");
      }

      const saved = (await response.json()) as Task;

      setTasks((current) =>
        task
          ? current.map((item) => (item.id === saved.id ? saved : item))
          : [saved, ...current],
      );
    },
    [],
  );

  const toggleTaskDone = useCallback(async (task: Task) => {
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: !task.done }),
      });

      if (!response.ok) {
        throw new Error("Failed to update task");
      }

      const saved = (await response.json()) as Task;

      setTasks((current) => {
        const updated = current.map((item) =>
          item.id === saved.id ? saved : item,
        );
        // Concluidas ficam no fim da lista.
        return updated.sort(sortTasksForList);
      });
    } catch (error) {
      console.error(error);
    }
  }, []);

  /** Define o estado de conclusão de uma tarefa (usado quando sub-tarefas são reabertas). */
  const setTaskDone = useCallback((id: string, done: boolean) => {
    setTasks((current) => {
      const updated = current.map((item) =>
        item.id === id ? { ...item, done } : item,
      );
      // Concluidas ficam no fim da lista.
      return updated.sort(sortTasksForList);
    });
  }, []);

  const duplicateTask = useCallback(
    async (task: Task, duplicateSuffix: string) => {
      try {
        const response = await fetch(`/api/tasks/${task.id}/duplicate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: `${task.title} (${duplicateSuffix})`,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to duplicate task");
        }

        const copy = (await response.json()) as Task;
        setTasks((current) => [copy, ...current]);
      } catch (error) {
        console.error(error);
      }
    },
    [],
  );

  const deleteTask = useCallback(async (task: Task | null) => {
    if (!task) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete task");
      }

      setTasks((current) => current.filter((item) => item.id !== task.id));
    } catch (error) {
      console.error(error);
    } finally {
      setIsDeleting(false);
    }
  }, []);

  return {
    tasks,
    isLoading,
    isDeleting,
    saveTask,
    toggleTaskDone,
    setTaskDone,
    duplicateTask,
    deleteTask,
  };
}