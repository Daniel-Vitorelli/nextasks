import type { UserPatch } from "@/types/domain";

const NAME_MAX_LENGTH = 50;
const TZ_OFFSET_MIN = -12 * 60;
const TZ_OFFSET_MAX = 14 * 60;
// Avatar PNG data URL (base64): ~1MB de imagem -> ~1.37MB de string.
const IMAGE_DATA_URL_MAX_LENGTH = 1536 * 1024;
const IMAGE_DATA_URL_PATTERN = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/;

/**
 * Valida o payload de PATCH /api/user. Campos ausentes são ignorados;
 * um payload sem nenhum campo válido retorna null.
 */
export function parseUserPatch(value: unknown): UserPatch | null {
  const body = (value ?? {}) as Record<string, unknown>;
  const patch: UserPatch = {};

  if (body.name !== undefined) {
    if (typeof body.name !== "string") return null;
    const name = body.name.trim();
    if (name.length === 0 || name.length > NAME_MAX_LENGTH) return null;
    patch.name = name;
  }

  if (body.timezoneOffset !== undefined) {
    if (body.timezoneOffset === null) {
      patch.timezoneOffset = null;
    } else if (
      typeof body.timezoneOffset !== "number" ||
      !Number.isInteger(body.timezoneOffset) ||
      body.timezoneOffset < TZ_OFFSET_MIN ||
      body.timezoneOffset > TZ_OFFSET_MAX
    ) {
      return null;
    } else {
      patch.timezoneOffset = body.timezoneOffset;
    }
  }

  if (body.image !== undefined) {
    if (body.image === null) {
      patch.image = null;
    } else if (
      typeof body.image !== "string" ||
      body.image.length === 0 ||
      body.image.length > IMAGE_DATA_URL_MAX_LENGTH ||
      !IMAGE_DATA_URL_PATTERN.test(body.image)
    ) {
      return null;
    } else {
      patch.image = body.image;
    }
  }

  if (
    patch.name === undefined &&
    patch.timezoneOffset === undefined &&
    patch.image === undefined
  ) {
    return null;
  }

  return patch;
}