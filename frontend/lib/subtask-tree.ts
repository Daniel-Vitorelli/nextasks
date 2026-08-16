import type { Subtask } from "@/types/domain";

/** Insere um nó na árvore (por parentId, ou na raiz). */
export function insertNode(
  nodes: Subtask[],
  node: Subtask,
  parentId: string | null,
): Subtask[] {
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
export function updateNode(
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
export function markSubtreeDone(
  nodes: Subtask[],
  id: string | null,
): Subtask[] {
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
export function unmarkPath(nodes: Subtask[], id: string): Subtask[] {
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