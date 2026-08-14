"use client";

import { useCallback } from "react";
import type { FieldErrors } from "react-hook-form";

/**
 * Returns a `showError(field)` predicate following the app-wide convention:
 * an error is shown only after the field was touched (or the form was
 * submitted). Handles both RHF `touchedFields` and manually tracked
 * blur state (e.g. the event detail form).
 */
export function useFieldErrors<TField extends string>(
  errors: FieldErrors,
  touchedFields: Partial<Record<TField, boolean>>,
  isSubmitted: boolean,
) {
  return useCallback(
    (field: TField) => !!errors[field] && (touchedFields[field] || isSubmitted),
    [errors, touchedFields, isSubmitted],
  );
}
