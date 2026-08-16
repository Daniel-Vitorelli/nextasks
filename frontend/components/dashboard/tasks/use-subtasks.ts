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

/**
 * Remove um nó (com a sub-árvore) e recalcula os ancestrais: se todos os
 * filhos restantes estiverem feitos (ou não restar nenhum), o ancestral
 * volta a ficar feito, subindo a cadeia. Retorna null se o nó não existir.
 */
export function removeAndRecomplete(
  nodes: Subtask[],
  id: string,
): Subtask[] | null {
  let changed = false;
  const result: Subtask[] = [];
  for (const item of nodes) {
    if (item.id === id) {
      changed = true;
      continue;
    }
    const children = removeAndRecomplete(item.children, id);
    if (children === null) {
      result.push(item);
      continue;
    }
    changed = true;
    const allChildrenDone =
      children.length === 0 || children.every((child) => child.done);
    result.push(
      allChildrenDone
        ? { ...item, done: true, children }
        : { ...item, children },
    );
  }
  return changed ? result : null;
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

/** Marca um nó e toda a sub-árvore abaixo dele como feitos. */
export function markSubtreeDone(nodes: Subtask[], id: string | null): Subtask[] {
  return nodes.map((item) => {
    if (id === null || item.id === id) {
      return {
        ...item,
        done: true,
        children: markSubtreeDone(item.children, null),
      };
    }
    return { ...item, children: markSubtreeDone(item.children, id) };
  });
}

/** Desmarca um nó e todos os ancestrais no caminho até a raiz da árvore. */
function unmarkPath(nodes: Subtask[], id: string): Subtask[] {
  return nodes.map((item) => {
    if (item.id === id) {
      return { ...item, done: false };
    }
    const children = unmarkPath(item.children, id);
    const containsPath = children.some(
      (child, index) => child !== item.children[index],
    );
    return containsPath ? { ...item, done: false, children } : item;
  });
}

/**
 * Sobe a cadeia após concluir um nó: ancestrais com todos os filhos feitos
 * também ficam feitos (o nó de partida deve já estar marcado).
 */
export function completeAncestors(nodes: Subtask[], id: string): Subtask[] {
  return nodes.map((item) => {
    if (item.id === id) {
      return { ...item, done: true };
    }
    const children = completeAncestors(item.children, id);
    const containsPath = children.some(
      (child, index) => child !== item.children[index],
    );
    if (!containsPath) return item;
    const allChildrenDone = children.every((child) => child.done);
    return allChildrenDone
      ? { ...item, done: true, children }
      : { ...item, children };
  });
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