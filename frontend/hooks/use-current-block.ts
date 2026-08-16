"use client";

import { useCallback, useEffect, useState } from "react";

import type { Period, Routine, TimeBlock } from "@/types/domain";

/** Resposta do endpoint /api/routines/current-block. */
export interface CurrentBlockResponse {
  routine: Routine | null;
  blocks: TimeBlock[];
  period: Period | null;
}

const REFRESH_INTERVAL_MS = 60_000;

/**
 * Carrega os blocos aplicáveis "agora" da rotina ativa, com polling de 60s
 * para acompanhar mudanças de horário sem interação do usuário.
 */
export function useCurrentBlock() {
  const [current, setCurrent] = useState<CurrentBlockResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const tzOffsetMinutes = new Date().getTimezoneOffset();

  const loadCurrentBlock = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/routines/current-block?tzOffset=${tzOffsetMinutes}`,
      );

      if (!response.ok) {
        throw new Error("Failed to load current block");
      }

      setCurrent((await response.json()) as CurrentBlockResponse);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [tzOffsetMinutes]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void loadCurrentBlock();
    const interval = setInterval(loadCurrentBlock, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadCurrentBlock]);
  /* eslint-enable react-hooks/set-state-in-effect */

  /** Remove um bloco confirmado da lista local. */
  const removeBlock = useCallback((blockId: string) => {
    setCurrent((state) =>
      state
        ? { ...state, blocks: state.blocks.filter((block) => block.id !== blockId) }
        : state,
    );
  }, []);

  return { current, isLoading, removeBlock, refetch: loadCurrentBlock };
}