"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  completeAncestors,
  insertNode,
  markSubtreeDone,
  removeAndRecomplete,
  unmarkPath,
  updateNode,
} from "@/lib/subtask-tree";
import {
  notifyDataChanged,
  useDataSync,
  type DataResource,
} from "@/lib/client/data-events";
import type { Subtask, SubtaskFormValues } from "@/types/domain";
import { useTzOffset } from "@/lib/client/use-tz-offset";

const AFTER_DONE_CHANGE: DataResource[] = [
  "tasks",
  "subtasks",
  "connections",
  "time-blocks",
  "progress",
  "current-block",
];
const AFTER_STRUCTURE_CHANGE: DataResource[] = ["subtasks", "tasks"];

/**
 * Loads and mutates the subtask tree of a task.
 */
export function useSubtasks(taskId: string | null) {
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // Snapshot da arvore antes de cada mutacao otimista, para rollback fiel
  // (capturado dentro do updater, sem closure stale).
  const rollbackRef = useRef<Subtask[] | null>(null);
  const inFlightToggles = useRef(new Set<string>());

  const tzOffsetMinutes = useTzOffset();

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

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (taskId) {
      void loadSubtasks(taskId);
    } else {
      setSubtasks([]);
    }
  }, [taskId, loadSubtasks]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Conexões, tarefas e blocos (bloco -> sub-tarefa) podem mudar a árvore
  // server-side: recarrega quando qualquer um deles muda.
  useDataSync(["subtasks", "tasks", "connections", "time-blocks"], () => {
    if (taskId) void loadSubtasks(taskId);
  });

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
        notifyDataChanged(AFTER_STRUCTURE_CHANGE);
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

      rollbackRef.current = null;
      setSubtasks((current) => {
        rollbackRef.current = current;
        return updateNode(current, id, values);
      });

      try {
        const response = await fetch(`/api/subtasks/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        });

        if (!response.ok) {
          throw new Error("Failed to update subtask");
        }
        notifyDataChanged(AFTER_STRUCTURE_CHANGE);
      } catch (error) {
        console.error(error);
        if (rollbackRef.current) {
          setSubtasks(rollbackRef.current);
        }
      }
    },
    [taskId],
  );

  const toggleSubtaskDone = useCallback(
    async (id: string, done: boolean) => {
      if (!taskId) return;

      // Ignora cliques enquanto um toggle do mesmo no esta em voo.
      if (inFlightToggles.current.has(id)) return;
      inFlightToggles.current.add(id);

      rollbackRef.current = null;
      // Concluir uma sub-tarefa conclui a sub-árvore abaixo dela e sobe a
      // cadeia: ancestrais com todos os filhos feitos também ficam feitos.
      // Reabrir desmarca o nó e toda a cadeia de ancestrais.
      setSubtasks((current) => {
        rollbackRef.current = current;
        return done
          ? completeAncestors(markSubtreeDone(current, id), id)
          : unmarkPath(current, id);
      });

      try {
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

        // Reconcilia com a resposta do servidor (o nó pode ter sido
        // concluído server-side por conexões no mesmo período).
        const saved = (await response.json()) as Subtask;
        setSubtasks((current) => updateNode(current, id, { done: saved.done }));
        notifyDataChanged(AFTER_DONE_CHANGE);
      } catch (error) {
        console.error(error);
        if (rollbackRef.current) {
          setSubtasks(rollbackRef.current);
        }
      } finally {
        inFlightToggles.current.delete(id);
      }
    },
    [taskId, tzOffsetMinutes],
  );

  const deleteSubtask = useCallback(
    async (id: string) => {
      if (!taskId) return;

      rollbackRef.current = null;
      // Excluir recalcula os ancestrais: sem filhos pendentes, o ancestral
      // volta a ficar feito (subindo a cadeia).
      setSubtasks((current) => {
        rollbackRef.current = current;
        return removeAndRecomplete(current, id) ?? current;
      });

      try {
        const response = await fetch(`/api/subtasks/${id}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          throw new Error("Failed to delete subtask");
        }
        notifyDataChanged(AFTER_STRUCTURE_CHANGE);
      } catch (error) {
        console.error(error);
        if (rollbackRef.current) {
          setSubtasks(rollbackRef.current);
        }
      }
    },
    [taskId],
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