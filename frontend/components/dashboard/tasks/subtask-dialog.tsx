"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import z from "zod";

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
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useFieldErrors } from "@/hooks/use-field-errors";
import type { Subtask, SubtaskFormValues } from "@/types/domain";

interface SubtaskDialogProps {
  open: boolean;
  parentTitle: string;
  subtask: Subtask | null;
  onOpenChange: (open: boolean) => void;
  onSave: (values: SubtaskFormValues) => Promise<void>;
}

export function SubtaskDialog({
  open,
  parentTitle,
  subtask,
  onOpenChange,
  onSave,
}: SubtaskDialogProps) {
  const t = useTranslations("dashboard.tasks.subtasks");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {subtask ? t("editTitle") : t("createTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("createDescription", { title: parentTitle })}
          </DialogDescription>
        </DialogHeader>

        <SubtaskForm
          key={subtask?.id ?? "create"}
          subtask={subtask}
          onSave={onSave}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

interface SubtaskFormProps {
  subtask: Subtask | null;
  onSave: (values: SubtaskFormValues) => Promise<void>;
  onClose: () => void;
}

function SubtaskForm({ subtask, onSave, onClose }: SubtaskFormProps) {
  const t = useTranslations("dashboard.tasks.subtasks");

  const schema = useMemo(
    () =>
      z.object({
        title: z.string().trim().min(1, t("titleRequired")),
        description: z.string(),
      }),
    [t],
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitted, touchedFields, isSubmitting },
  } = useForm<SubtaskFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: subtask?.title ?? "",
      description: subtask?.description ?? "",
    },
    mode: "onChange",
  });

  const showError = useFieldErrors<keyof SubtaskFormValues>(
    errors,
    touchedFields,
    isSubmitted,
  );

  const onSubmit = handleSubmit(async (data) => {
    try {
      await onSave(data);
      onClose();
    } catch (error) {
      console.error(error);
    }
  });

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <Field className="space-y-2 gap-0" data-invalid={showError("title")}>
        <FieldLabel htmlFor="subtask-title">{t("titleLabel")}</FieldLabel>
        <Input
          id="subtask-title"
          autoFocus
          {...register("title")}
          aria-invalid={showError("title")}
          placeholder={t("titlePlaceholder")}
        />
        {showError("title") && (
          <FieldError>{errors.title!.message}</FieldError>
        )}
      </Field>

      <Field className="space-y-2 gap-0" data-invalid={showError("description")}>
        <FieldLabel htmlFor="subtask-description">
          {t("descriptionLabel")}
        </FieldLabel>
        <Textarea
          id="subtask-description"
          {...register("description")}
          aria-invalid={showError("description")}
          placeholder={t("descriptionPlaceholder")}
          rows={3}
        />
        {showError("description") && (
          <FieldError>{errors.description!.message}</FieldError>
        )}
      </Field>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {t("cancel")}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? <Spinner />
            : subtask
              ? t("submitEdit")
              : t("submit")}
        </Button>
      </DialogFooter>
    </form>
  );
}