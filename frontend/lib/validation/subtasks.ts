import type { SubtaskPatch, SubtaskPayload } from "@/types/domain";
import { trimmedStringOrNull } from "./helpers";

export function parseSubtaskInput(value: unknown): SubtaskPayload | null {
  const body = (value ?? {}) as Record<string, unknown>;

  const title = trimmedStringOrNull(body.title);
  if (!title) return null;

  return {
    title,
    description: trimmedStringOrNull(body.description),
  };
}

export function parseSubtaskPatch(value: unknown): SubtaskPatch | null {
  const body = (value ?? {}) as Record<string, unknown>;
  const patch: SubtaskPatch = {};

  if (typeof body.title === "string") {
    const title = body.title.trim();
    if (!title) return null;
    patch.title = title;
  }

  if (typeof body.description === "string") {
    patch.description = body.description.trim() || null;
  }

  if (typeof body.done === "boolean") {
    patch.done = body.done;
  }

  return patch;
}