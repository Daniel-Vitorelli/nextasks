/**
 * Guardas compartilhadas usadas pelos parsers de payload da API.
 */

/**
 * Retorna a string trimmed, ou null se o valor não for string ou ficar vazio
 * após o trim. Usado tanto para campos opcionais (null = ausente) quanto
 * obrigatórios (o chamador rejeita null).
 */
export function trimmedStringOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

/** Converte uma string de data válida em Date, ou null se ausente/inválida. */
export function dateFromString(value: unknown): Date | null {
  if (typeof value !== "string" || !value) return null;
  if (Number.isNaN(Date.parse(value))) return null;
  return new Date(value);
}