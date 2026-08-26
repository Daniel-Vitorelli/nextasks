import OpenAI from "openai";

/**
 * Cliente da NVIDIA NIM: API compatível com OpenAI em
 * https://integrate.api.nvidia.com/v1 (build.nvidia.com). Retorna null quando
 * a chave não está configurada — as rotas respondem com erro amigável.
 */
export function getNimClient(): OpenAI | null {
  const apiKey = process.env.NVIDIA_NIM_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({
    apiKey,
    baseURL:
      process.env.NVIDIA_NIM_BASE_URL ?? "https://integrate.api.nvidia.com/v1",
    timeout: 120_000,
    maxRetries: 1,
  });
}

export function nimModel(): string {
  return process.env.NIM_MODEL ?? "meta/llama-3.3-70b-instruct";
}

export const CHAT_TEMPERATURE = 0.6;
export const CHAT_MAX_TOKENS = 1024;

/** Quantas mensagens recentes entram verbatim no contexto. */
export const RECENT_MESSAGE_WINDOW = 24;
/** A partir de quantas mensagens o resumo rolante é (re)gerado. */
export const SUMMARY_TRIGGER_COUNT = 30;
