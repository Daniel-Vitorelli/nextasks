"use client";

import { useSession } from "@/components/app/session-provider";

/**
 * Offset de fuso horário (minutos a oeste de UTC) usado pelas chamadas de
 * API. Respeita o fuso configurado pelo usuário em /app/config; sem
 * configuração, usa o fuso do navegador.
 */
export function useTzOffset(): number {
  const { user } = useSession() ?? {};
  return user?.timezoneOffset ?? new Date().getTimezoneOffset();
}