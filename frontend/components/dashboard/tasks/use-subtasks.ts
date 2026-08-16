"use client";

import { useCallback, useEffect, useState } from "react";
import type { Subtask, SubtaskFormValues } from "@/types/domain";

/** Insere um nó na árvore (por parentId, ou na raiz). */
function insertNode(nodes: Subtask[], node: Subtask, parentId: string | null): Subtask[] {
  if (!parentId) {
    return [...nodes, node];
  }
  return nodes.map((item) =>
    item.id === parentId
      ? { ...item, children: [...item.children, node] }
      : { ...item, children: insertNode(item.children, node, parentId) },
  );
}

/** Remove um nó e toda a sub-árvore abaixo dele. */
function removeNode(nodes: Subtask[], id: string): Subtask[] {
  const result = nodes.filter((item) => item.id !== id);
  return result.map((item) => ({
    ...item,
    children: removeNode(item.children, id),
  }));
}

/** Atualiza título/descrição/conclusão de um nó existente. */
function updateNode(
  nodes: Subtask[],
  id: string,
  patch: Partial<Pick<Subtask, "title" | "description" | "done">>,
): Subtask[] {
  return nodes.map((item) =>
    item.id === id
      ? { ...item, ...patch }
      : { ...item, children: updateNode(item.children, id, patch) },
  );
}

/**
 * Loads and mutates the subtask tree of a task.
 */
export function useSubtasks(taskId: string | null) {
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadSubtasks = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/tasks/${id}/subtasks`);

      if (!response.ok) {
        throw new Error("Failed to load subtasks");
      }

      setSubtasks((await response.json()) as Subtask[]);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (taskId) {
      void loadSubtasks(taskId);
    } else {
      setSubtasks([]);
    }
  }, [taskId, loadSubtasks]);

  const createSubtask = useCallback(
    async (values: SubtaskFormValues, parentId: string | null = null) => {
      if (!taskId) return null;

      try {
        const response = await fetch(`/api/tasks/${taskId}/subtasks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...values, parentId }),
        });

        if (!response.ok) {
          throw new Error("Failed to create subtask");
        }

        const saved = (await response.json()) as Omit<Subtask, "children">;
        const node: Subtask = {
          id: saved.id,
          title: saved.title,
          description: saved.description,
          parentId: saved.parentId,
          done: saved.done,
          children: [],
        };
        setSubtasks((current) => insertNode(current, node, saved.parentId));
        return node;
      } catch (error) {
        console.error(error);
        return null;
      }
    },
    [taskId],
  );

  const updateSubtask = useCallback(
    async (id: string, values: SubtaskFormValues) => {
      if (!taskId) return;

      const previous = subtasks;
      setSubtasks((current) => updateNode(current, id, values));

      try {
        const response = await fetch(`/api/subtasks/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        });

        if (!response.ok) {
          throw new Error("Failed to update subtask");
        }
      } catch (error) {
        console.error(error);
        setSubtasks(previous);
      }
    },
    [taskId, subtasks],
  );

  const toggleSubtaskDone = useCallback(
    async (id: string, done: boolean) => {
      if (!taskId) return;

      const previous = subtasks;
      setSubtasks((current) => updateNode(current, id, { done }));

      try {
        const response = await fetch(`/api/subtasks/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ done }),
        });

        if (!response.ok) {
          throw new Error("Failed to update subtask");
        }
      } catch (error) {
        console.error(error);
        setSubtasks(previous);
      }
    },
    [taskId, subtasks],
  );

  const deleteSubtask = useCallback(
    async (id: string) => {
      if (!taskId) return;

      const previous = subtasks;
      setSubtasks((current) => removeNode(current, id));

      try {
        const response = await fetch(`/api/subtasks/${id}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          throw new Error("Failed to delete subtask");
        }
      } catch (error) {
        console.error(error);
        setSubtasks(previous);
      }
    },
    [taskId, subtasks],
  );

  return {
    subtasks,
    isLoading,
    loadSubtasks,
    createSubtask,
    updateSubtask,
    toggleSubtaskDone,
    deleteSubtask,
  };
}