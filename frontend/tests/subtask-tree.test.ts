import { describe, expect, it } from "vitest";
import type { Subtask } from "@/types/domain";
import {
  completeAncestors,
  insertNode,
  markSubtreeDone,
  removeAndRecomplete,
  unmarkPath,
  updateNode,
} from "@/lib/subtask-tree";

function node(
  id: string,
  overrides: Partial<Subtask> = {},
): Subtask {
  return {
    id,
    title: id,
    description: null,
    parentId: null,
    done: false,
    children: [],
    ...overrides,
  };
}

describe("insertNode", () => {
  it("insere na raiz quando parentId é null", () => {
    const tree = [node("a"), node("b")];
    const result = insertNode(tree, node("c"), null);
    expect(result.map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  it("insere como filho do pai indicado, recursivamente", () => {
    const tree = [node("a", { children: [node("a1")] })];
    const result = insertNode(tree, node("a2"), "a1");
    expect(result[0].children[0].children[0].id).toBe("a2");
  });
});

describe("updateNode", () => {
  it("atualiza os campos do nó encontrado", () => {
    const tree = [node("a", { children: [node("b", { done: true })] })];
    const result = updateNode(tree, "b", { title: "novo", done: false });
    expect(result[0].children[0].title).toBe("novo");
    expect(result[0].children[0].done).toBe(false);
  });

  it("não altera a árvore quando o nó não existe", () => {
    const tree = [node("a")];
    const result = updateNode(tree, "zzz", { title: "x" });
    expect(result).toEqual(tree);
  });
});

describe("markSubtreeDone", () => {
  it("marca o nó e toda a sub-árvore", () => {
    const tree = [
      node("a", { children: [node("b", { children: [node("c")] })] }),
    ];
    const result = markSubtreeDone(tree, "b");
    expect(result[0].done).toBe(false);
    expect(result[0].children[0].done).toBe(true);
    expect(result[0].children[0].children[0].done).toBe(true);
  });

  it("marca tudo quando id é null", () => {
    const tree = [node("a", { children: [node("b")] })];
    const result = markSubtreeDone(tree, null);
    expect(result[0].done).toBe(true);
    expect(result[0].children[0].done).toBe(true);
  });
});

describe("unmarkPath", () => {
  it("desmarca o nó e todos os ancestrais no caminho", () => {
    const tree = [
      node("a", {
        done: true,
        children: [
          node("b", { done: true, children: [node("c", { done: true })] }),
        ],
      }),
    ];
    const result = unmarkPath(tree, "c");
    expect(result[0].done).toBe(false);
    expect(result[0].children[0].done).toBe(false);
    expect(result[0].children[0].children[0].done).toBe(false);
  });

  it("não desmarca ramos fora do caminho", () => {
    const tree = [
      node("a", {
        done: true,
        children: [
          node("b", { done: true }),
          node("x", { done: true }),
        ],
      }),
    ];
    const result = unmarkPath(tree, "b");
    expect(result[0].done).toBe(false);
    expect(result[0].children[0].done).toBe(false);
    expect(result[0].children[1].done).toBe(true);
  });
});

describe("completeAncestors", () => {
  it("sobe a cadeia enquanto todos os filhos estiverem feitos", () => {
    const tree = [
      node("a", {
        children: [node("b", { children: [node("c")] }), node("x")],
      }),
    ];
    // Marca c: c e b ficam feitos, mas a continua pendente (x não está feito).
    const withC = completeAncestors(tree, "c");
    expect(withC[0].children[0].done).toBe(true);
    expect(withC[0].children[0].children[0].done).toBe(true);
    expect(withC[0].done).toBe(false);

    // Agora marca x: a deve ficar feito.
    const withX = completeAncestors(withC, "x");
    expect(withX[0].done).toBe(true);
  });
});

describe("removeAndRecomplete", () => {
  it("remove o nó e recalcula os ancestrais feitos", () => {
    const tree = [
      node("a", {
        children: [
          node("b", { done: true, children: [node("c", { done: true })] }),
        ],
      }),
    ];
    const result = removeAndRecomplete(tree, "c");
    expect(result![0].children[0].id).toBe("b");
    // Todos os filhos restantes de b estão feitos (nenhum resta) → b volta a feito.
    expect(result![0].children[0].done).toBe(true);
  });

  it("retorna null quando o nó não existe", () => {
    const tree = [node("a")];
    expect(removeAndRecomplete(tree, "zzz")).toBeNull();
  });

  it("mantém o ancestral pendente se sobrar filho não feito", () => {
    const tree = [
      node("a", {
        children: [
          node("b", { done: true, children: [node("c", { done: true })] }),
          node("y", { done: false }),
        ],
      }),
    ];
    const result = removeAndRecomplete(tree, "c");
    // b perdeu o filho c, mas continua com y... na verdade y é filho de a.
    expect(result![0].children[0].done).toBe(true);
    expect(result![0].done).toBe(false);
  });
});