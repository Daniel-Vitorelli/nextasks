"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import type { Routine, RoutineFormValues } from "@/types/domain";
import { createRoutineSchema } from "@/schemas/routine-schema";
import { useFieldErrors } from "@/hooks/use-field-errors";

interface RoutineDialogProps {
  open: boolean;
  routine: Routine | null;
  onOpenChange: (open: boolean) => void;
  onSave: (
    values: RoutineFormValues,
    routine: Routine | null,
  ) => Promise<void>;
}

export function RoutineDialog({
  open,
  routine,
  onOpenChange,
  onSave,
}: RoutineDialogProps) {
  const t = useTranslations("dashboard.routines.dialog");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{routine ? t("editTitle") : t("title")}</DialogTitle>
          <DialogDescription>
            {routine ? t("editDescription") : t("description")}
          </DialogDescription>
        </DialogHeader>

        <RoutineForm
          key={routine?.id ?? "create"}
          routine={routine}
          onSave={onSave}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

interface RoutineFormProps {
  routine: Routine | null;
  onSave: RoutineDialogProps["onSave"];
  onClose: () => void;
}

function toDefaultValues(routine: Routine | null): RoutineFormValues {
  if (!routine) {
    return {
      name: "",
      description: "",
      frequency: "daily",
      duration: "indefinite",
      endDate: "",
    };
  }

  return {
    name: routine.name,
    description: routine.description ?? "",
    frequency: routine.frequency,
    duration: routine.duration,
    endDate: routine.endDate ? routine.endDate.slice(0, 10) : "",
  };
}

function RoutineForm({ routine, onSave, onClose }: RoutineFormProps) {
  const t = useTranslations("dashboard.routines.dialog");

  const schema = useMemo(() => createRoutineSchema(t), [t]);

  const {
    control,
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitted, touchedFields, isSubmitting },
  } = useForm<RoutineFormValues>({
    resolver: zodResolver(schema),
    defaultValues: toDefaultValues(routine),
    mode: "onChange",
  });

  const duration = watch("duration");

  const showError = useFieldErrors<keyof RoutineFormValues>(
    errors,
    touchedFields,
    isSubmitted,
  );

  const onSubmit = handleSubmit(async (data) => {
    try {
      await onSave(data, routine);
      onClose();
    } catch (error) {
      console.error(error);
    }
  });

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <Field className="space-y-2 gap-0" data-invalid={showError("name")}>
        <FieldLabel htmlFor="routine-name">{t("nameLabel")}</FieldLabel>
        <Input
          id="routine-name"
          autoFocus
          {...register("name")}
          aria-invalid={showError("name")}
          placeholder={t("namePlaceholder")}
        />
        {showError("name") && (
          <FieldError>{errors.name!.message}</FieldError>
        )}
      </Field>

      <Field className="space-y-2 gap-0" data-invalid={showError("description")}>
        <FieldLabel htmlFor="routine-description">
          {t("descriptionLabel")}
        </FieldLabel>
        <Textarea
          id="routine-description"
          {...register("description")}
          aria-invalid={showError("description")}
          placeholder={t("descriptionPlaceholder")}
          rows={3}
        />
        {showError("description") && (
          <FieldError>{errors.description!.message}</FieldError>
        )}
      </Field>

      <div className="space-y-2">
        <FieldLabel>{t("frequencyLabel")}</FieldLabel>
        <Controller
          control={control}
          name="frequency"
          render={({ field }) => (
            <RadioGroup
              value={field.value}
              onValueChange={field.onChange}
              className="grid grid-cols-2 gap-2"
            >
              <RadioOption
                value="daily"
                id="frequency-daily"
                label={t("daily")}
              />
              <RadioOption
                value="weekly"
                id="frequency-weekly"
                label={t("weekly")}
              />
            </RadioGroup>
          )}
        />
      </div>

      <div className="space-y-2">
        <FieldLabel>{t("durationLabel")}</FieldLabel>
        <Controller
          control={control}
          name="duration"
          render={({ field }) => (
            <RadioGroup
              value={field.value}
              onValueChange={field.onChange}
              className="grid grid-cols-2 gap-2"
            >
              <RadioOption
                value="indefinite"
                id="duration-indefinite"
                label={t("indefinite")}
              />
              <RadioOption
                value="until"
                id="duration-until"
                label={t("until")}
              />
            </RadioGroup>
          )}
        />
      </div>

      {duration === "until" && (
        <Field className="space-y-2 gap-0" data-invalid={showError("endDate")}>
          <FieldLabel htmlFor="routine-end-date">{t("endDateLabel")}</FieldLabel>
          <Input
            id="routine-end-date"
            type="date"
            {...register("endDate")}
            aria-invalid={showError("endDate")}
          />
          {showError("endDate") && (
            <FieldError>{errors.endDate!.message}</FieldError>
          )}
        </Field>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {t("cancel")}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? <Spinner />
            : routine
              ? t("submitEdit")
              : t("submit")}
        </Button>
      </DialogFooter>
    </form>
  );
}

function RadioOption({
  value,
  id,
  label,
}: {
  value: string;
  id: string;
  label: string;
}) {
  return (
    <label className="border-border/60 hover:border-primary/50 hover:bg-primary/5 flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 transition-colors has-data-checked:border-primary has-data-checked:bg-primary/5">
      <RadioGroupItem value={value} id={id} />
      <span className="text-sm font-medium">{label}</span>
    </label>
  );
}