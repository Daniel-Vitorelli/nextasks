"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface AiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface AiConversationSummary {
  id: string;
  title: string | null;
  updatedAt: string;
  messageCount: number;
}

export interface MemoryFactView {
  id: string;
  fact: string;
  source: string;
}

let localIdCounter = 0;
function tempId(prefix: string): string {
  localIdCounter += 1;
  return `${prefix}-${Date.now()}-${localIdCounter}`;
}

/**
 * Estado do chat de IA: lista de conversas, mensagens ativas e envio com
 * streaming (leitura manual do body — sem dependências externas).
 */
export function useAiChat(locale: string) {
  const [conversations, setConversations] = useState<AiConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isOpenLoadingMessages, setIsOpenLoadingMessages] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadConversations = useCallback(async () => {
    try {
      const response = await fetch("/api/ai/conversations");
      if (!response.ok) throw new Error("Failed");
      setConversations((await response.json()) as AiConversationSummary[]);
    } catch {
      // sidebar permanece vazia em caso de falha transitória
    } finally {
      setIsLoadingConversations(false);
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const openConversation = useCallback(async (conversationId: string) => {
    setIsOpenLoadingMessages(true);
    setActiveId(conversationId);
    try {
      const response = await fetch(`/api/ai/conversations/${conversationId}`);
      if (!response.ok) throw new Error("Failed");
      const data = (await response.json()) as {
        messages: { id: string; role: string; content: string }[];
      };
      setMessages(
        data.messages.map((message) => ({
          id: message.id,
          role: message.role === "assistant" ? "assistant" : "user",
          content: message.content,
        })),
      );
      setStreamError(null);
    } catch {
      setStreamError("load_failed");
    } finally {
      setIsOpenLoadingMessages(false);
    }
  }, []);

  const newConversation = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setActiveId(null);
    setMessages([]);
    setStreamError(null);
  }, []);

  const deleteConversation = useCallback(
    async (conversationId: string) => {
      await fetch(`/api/ai/conversations/${conversationId}`, { method: "DELETE" });
      setConversations((current) =>
        current.filter((conversation) => conversation.id !== conversationId),
      );
      if (activeId === conversationId) newConversation();
    },
    [activeId, newConversation],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;

      setStreamError(null);
      setIsStreaming(true);

      const assistantTempId = tempId("assistant");
      setMessages((current) => [
        ...current,
        { id: tempId("user"), role: "user", content: trimmed },
        { id: assistantTempId, role: "assistant", content: "" },
      ]);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            conversationId: activeId ?? undefined,
            message: trimmed,
            locale,
          }),
        });

        if (!response.ok) {
          throw new Error(response.status === 503 ? "not_configured" : "generic");
        }

        const conversationId = response.headers.get("X-Conversation-Id");
        if (conversationId && !activeId) setActiveId(conversationId);

        // Substitui a mensagem temporária do usuário por nada — mantemos só
        // o texto; o assistente recebe os chunks incrementais.
        let accumulated = "";
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        while (reader) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantTempId
                ? { ...message, content: accumulated }
                : message,
            ),
          );
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setStreamError(error instanceof Error ? error.message : "generic");
          setMessages((current) =>
            current.filter(
              (message) => !(message.id === assistantTempId && !message.content),
            ),
          );
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
        void loadConversations();
      }
    },
    [activeId, isStreaming, loadConversations, locale],
  );

  return {
    conversations,
    activeId,
    messages,
    isLoadingConversations,
    isOpenLoadingMessages,
    isStreaming,
    streamError,
    sendMessage,
    stop,
    openConversation,
    newConversation,
    deleteConversation,
    reloadConversations: loadConversations,
  };
}

/** Fatos duráveis da IA ("o que eu lembro sobre você"). */
export function useMemoryFacts() {
  const [facts, setFacts] = useState<MemoryFactView[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const response = await fetch("/api/ai/memory");
      if (!response.ok) throw new Error("Failed");
      setFacts((await response.json()) as MemoryFactView[]);
    } catch {
      // silencioso
    } finally {
      setIsLoading(false);
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void reload();
  }, [reload]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const addFact = useCallback(
    async (fact: string): Promise<boolean> => {
      const response = await fetch("/api/ai/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fact }),
      });
      if (!response.ok) return false;
      await reload();
      return true;
    },
    [reload],
  );

  const removeFact = useCallback(
    async (id: string): Promise<boolean> => {
      const response = await fetch(`/api/ai/memory/${id}`, { method: "DELETE" });
      if (!response.ok) return false;
      setFacts((current) => current.filter((entry) => entry.id !== id));
      return true;
    },
    [],
  );

  return { facts, isLoading, addFact, removeFact };
}
