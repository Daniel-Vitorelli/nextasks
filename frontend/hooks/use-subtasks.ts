"use client";

import { useCallback, useEffect, useState } from "react";
import {
  completeAncestors,
  insertNode,
  markSubtreeDone,
  removeAndRecomplete,
  unmarkPath,
  updateNode,
} from "@/lib/subtask-tree";
import { CONNECTIONS_CHANGED_EVENT } from "@/components/connections/connections-provider";
import type { Subtask, SubtaskFormValues } from "@/types/domain";

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

  // Conexões (bloco -> sub-tarefa) podem concluir nós server-side:
  // recarrega a árvore quando qualquer conexão muda.
  useEffect(() => {
    const handle = () => {
      if (taskId) void loadSubtasks(taskId);
    };
    window.addEventListener(CONNECTIONS_CHANGED_EVENT, handle);
    return () => window.removeEventListener(CONNECTIONS_CHANGED_EVENT, handle);
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
        setSubtasks((current) => {
          const updated = insertNode(current, node, saved.parentId);
          // Nova sub-tarefa nasce desmarcada: se o pai estiver concluído,
          // a cadeia de ancestrais é reaberta.
          return saved.parentId
            ? unmarkPath(updated, saved.parentId)
            : updated;
        });
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
      // Concluir uma sub-tarefa conclui a sub-árvore abaixo dela e sobe a
      // cadeia: ancestrais com todos os filhos feitos também ficam feitos.
      // Reabrir desmarca o nó e toda a cadeia de ancestrais.
      setSubtasks((current) =>
        done
          ? completeAncestors(markSubtreeDone(current, id), id)
          : unmarkPath(current, id),
      );

      try {
        const tzOffsetMinutes = new Date().getTimezoneOffset();
        const response = await fetch(
          `/api/subtasks/${id}?tzOffset=${tzOffsetMinutes}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ done }),
          },
        );

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
      // Excluir recalcula os ancestrais: sem filhos pendentes, o ancestral
      // volta a ficar feito (subindo a cadeia).
      setSubtasks((current) => removeAndRecomplete(current, id) ?? current);

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