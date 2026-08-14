"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";

import { applyTimeToDate, parseTimeInput } from "@/lib/time-blocks";
import {
  createTimeBlockSchema,
  type TimeBlockFormValues,
} from "@/schemas/time-block-schema";
import type { CalendarEvent } from "@/types/calendar";
import { useFieldErrors } from "@/hooks/use-field-errors";
import { formatTimeDisplay } from "./calendar-event-time";

function toDefaultFormValues(event: CalendarEvent): TimeBlockFormValues {
  return {
    title: event.title,
    description: event.description ?? "",
    startTime: formatTimeDisplay(event.start),
    endTime: formatTimeDisplay(event.end),
  };
}

/**
 * Form state for the event detail panel: validation, commit-on-blur
 * semantics (Enter commits, Escape restores) and the all-day toggle.
 */
export function useEventDetailForm(
  event: CalendarEvent,
  onEventChange?: (event: CalendarEvent) => void,
) {
  const t = useTranslations("dashboard.routines.calendar");

  const timeBlockSchema = React.useMemo(() => createTimeBlockSchema(t), [t]);

  const {
    register,
    getValues,
    setValue,
    reset,
    clearErrors,
    trigger,
    formState: { errors, isSubmitted },
  } = useForm<TimeBlockFormValues>({
    resolver: zodResolver(timeBlockSchema),
    defaultValues: toDefaultFormValues(event),
    mode: "onChange",
  });

  /** Tracks which fields the user has blurred, so errors appear only then
   * (same "show after touched" behavior as the login/routine forms). */
  const [blurredFields, setBlurredFields] = React.useState<
    Partial<Record<keyof TimeBlockFormValues, boolean>>
  >({});

  const showError = useFieldErrors<keyof TimeBlockFormValues>(
    errors,
    blurredFields,
    isSubmitted,
  );

  const { title, description, start, end } = event;

  React.useEffect(() => {
    reset({
      title,
      description: description ?? "",
      startTime: formatTimeDisplay(start),
      endTime: formatTimeDisplay(end),
    });
  }, [title, description, start, end, reset]);

  /** Set when Escape restored a field, so the commit on blur is skipped. */
  const escapePressedRef = React.useRef(false);
  const titleOnFocusRef = React.useRef(title);
  const descriptionOnFocusRef = React.useRef(description ?? "");
  const startTimeOnFocusRef = React.useRef(formatTimeDisplay(start));
  const endTimeOnFocusRef = React.useRef(formatTimeDisplay(end));

  const originalValue = React.useCallback((field: keyof TimeBlockFormValues) => {
    if (field === "title") {
      return titleOnFocusRef.current;
    }
    if (field === "description") {
      return descriptionOnFocusRef.current;
    }
    if (field === "startTime") {
      return startTimeOnFocusRef.current;
    }
    return endTimeOnFocusRef.current;
  }, []);

  const handleFieldFocus = React.useCallback(
    (e: React.FocusEvent<HTMLInputElement>, field: keyof TimeBlockFormValues) => {
      if (field === "title") {
        titleOnFocusRef.current = title;
        return;
      }
      if (field === "description") {
        descriptionOnFocusRef.current = description ?? "";
        return;
      }
      if (field === "startTime") {
        startTimeOnFocusRef.current = formatTimeDisplay(start);
      } else {
        endTimeOnFocusRef.current = formatTimeDisplay(end);
      }
      requestAnimationFrame(() => e.currentTarget.select());
    },
    [title, description, start, end],
  );

  const handleFieldKeyDown = React.useCallback(
    (
      e: React.KeyboardEvent<HTMLInputElement>,
      field: keyof TimeBlockFormValues,
    ) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.currentTarget.blur();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        escapePressedRef.current = true;
        setValue(field, originalValue(field));
        clearErrors(field);
        e.currentTarget.blur();
      }
    },
    [setValue, clearErrors, originalValue],
  );

  /** Marks all fields as blurred, so their errors become visible. */
  const revealErrors = React.useCallback(() => {
    setBlurredFields({
      title: true,
      startTime: true,
      endTime: true,
    });
  }, []);

  /** Validates the form and, when valid, commits changes to the event. */
  const commitFields = React.useCallback(async () => {
    if (escapePressedRef.current) {
      escapePressedRef.current = false;
      return;
    }

    const valid = await trigger();
    if (!valid) {
      revealErrors();
      return;
    }

    const values = getValues();
    const titleValue = values.title.trim();
    const descriptionValue = values.description?.trim() ?? "";
    const parsedStart = parseTimeInput(values.startTime);
    const parsedEnd = parseTimeInput(values.endTime);
    if (!parsedStart || !parsedEnd) {
      return;
    }

    const nextStart = applyTimeToDate(
      event.start,
      parsedStart.hours,
      parsedStart.minutes,
    );
    const nextEnd = applyTimeToDate(
      event.end,
      parsedEnd.hours,
      parsedEnd.minutes,
    );

    setValue("title", titleValue, { shouldValidate: false });
    setValue("description", descriptionValue, { shouldValidate: false });
    setValue("startTime", formatTimeDisplay(nextStart), {
      shouldValidate: false,
    });
    setValue("endTime", formatTimeDisplay(nextEnd), { shouldValidate: false });
    clearErrors();

    if (
      titleValue !== event.title ||
      descriptionValue !== (event.description ?? "") ||
      nextStart.getTime() !== event.start.getTime() ||
      nextEnd.getTime() !== event.end.getTime()
    ) {
      onEventChange?.({
        ...event,
        title: titleValue,
        description: descriptionValue || undefined,
        start: nextStart,
        end: nextEnd,
      });
    }
  }, [
    event,
    onEventChange,
    trigger,
    revealErrors,
    getValues,
    setValue,
    clearErrors,
  ]);

  /** Marks the field as touched and runs the commit on blur. */
  const handleFieldBlur = React.useCallback(
    (field: keyof TimeBlockFormValues) => {
      setBlurredFields((current) => ({ ...current, [field]: true }));
      void commitFields();
    },
    [commitFields],
  );

  /**
   * Stores the original hours/minutes before toggling to all-day.
   * When toggling off, these are applied to the current (possibly
   * resized) dates.
   */
  const savedTimeOfDayRef = React.useRef<{
    startHours: number;
    startMinutes: number;
    endHours: number;
    endMinutes: number;
  } | null>(null);

  const handleAllDayToggle = React.useCallback(
    (checked: boolean) => {
      if (checked) {
        savedTimeOfDayRef.current = {
          startHours: event.start.getHours(),
          startMinutes: event.start.getMinutes(),
          endHours: event.end.getHours(),
          endMinutes: event.end.getMinutes(),
        };
        onEventChange?.({ ...event, isAllDay: true });
        return;
      }

      if (savedTimeOfDayRef.current) {
        const { startHours, startMinutes, endHours, endMinutes } =
          savedTimeOfDayRef.current;
        onEventChange?.({
          ...event,
          isAllDay: false,
          start: applyTimeToDate(event.start, startHours, startMinutes),
          end: applyTimeToDate(event.end, endHours, endMinutes),
        });
        savedTimeOfDayRef.current = null;
        return;
      }

      /** Default 9 AM – 10 AM when no saved times (e.g., existing all-day event). */
      const DEFAULT_START_HOUR = 9;
      const DEFAULT_END_HOUR = 10;
      onEventChange?.({
        ...event,
        isAllDay: false,
        start: applyTimeToDate(event.start, DEFAULT_START_HOUR, 0),
        end: applyTimeToDate(event.end, DEFAULT_END_HOUR, 0),
      });
    },
    [event, onEventChange],
  );

  return {
    register,
    errors,
    showError,
    handleFieldFocus,
    handleFieldBlur,
    handleFieldKeyDown,
    handleAllDayToggle,
  };
}