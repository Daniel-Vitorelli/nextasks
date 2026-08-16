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
import { priorityBadgeStyles } from "@/components/dashboard/tasks/task-priority";
import type { Task, TaskFormValues, TaskPriority } from "@/types/domain";
import { createTaskSchema } from "@/schemas/task-schema";
import { useFieldErrors } from "@/hooks/use-field-errors";
import { cn } from "@/lib/utils";

interface TaskDialogProps {
  open: boolean;
  task: Task | null;
  onOpenChange: (open: boolean) => void;
  onSave: (values: TaskFormValues, task: Task | null) => Promise<void>;
}

export function TaskDialog({ open, task, onOpenChange, onSave }: TaskDialogProps) {
  const t = useTranslations("dashboard.tasks.dialog");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{task ? t("editTitle") : t("title")}</DialogTitle>
          <DialogDescription>
            {task ? t("editDescription") : t("description")}
          </DialogDescription>
        </DialogHeader>

        <TaskForm
          key={task?.id ?? "create"}
          task={task}
          onSave={onSave}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

interface TaskFormProps {
  task: Task | null;
  onSave: TaskDialogProps["onSave"];
  onClose: () => void;
}

function toDefaultValues(task: Task | null): TaskFormValues {
  if (!task) {
    return {
      title: "",
      description: "",
      dueDate: "",
      priority: 3,
    };
  }

  return {
    title: task.title,
    description: task.description ?? "",
    dueDate: task.dueDate ? task.dueDate.slice(0, 10) : "",
    priority: task.priority,
  };
}

function TaskForm({ task, onSave, onClose }: TaskFormProps) {
  const t = useTranslations("dashboard.tasks.dialog");
  const tRoot = useTranslations("dashboard.tasks");

  const schema = useMemo(() => createTaskSchema(t), [t]);

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitted, touchedFields, isSubmitting },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(schema),
    defaultValues: toDefaultValues(task),
    mode: "onChange",
  });

  const showError = useFieldErrors<keyof TaskFormValues>(
    errors,
    touchedFields,
    isSubmitted,
  );

  const onSubmit = handleSubmit(async (data) => {
    try {
      await onSave(data, task);
      onClose();
    } catch (error) {
      console.error(error);
    }
  });

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <Field className="space-y-2 gap-0" data-invalid={showError("title")}>
        <FieldLabel htmlFor="task-title">{t("titleLabel")}</FieldLabel>
        <Input
          id="task-title"
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
        <FieldLabel htmlFor="task-description">
          {t("descriptionLabel")}
        </FieldLabel>
        <Textarea
          id="task-description"
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
        <FieldLabel>{t("priorityLabel")}</FieldLabel>
        <Controller
          control={control}
          name="priority"
          render={({ field }) => (
            <RadioGroup
              value={String(field.value)}
              onValueChange={(value) => field.onChange(Number(value))}
              className="grid grid-cols-2 gap-2 sm:grid-cols-3"
            >
              {[1, 2, 3, 4, 5, 6].map((priority) => (
                <PriorityOption
                  key={priority}
                  value={priority}
                  label={tRoot(`priority_${priority}`)}
                  badgeClassName={priorityBadgeStyles[priority as TaskPriority]}
                />
              ))}
            </RadioGroup>
          )}
        />
      </div>

      <Field className="space-y-2 gap-0" data-invalid={showError("dueDate")}>
        <FieldLabel htmlFor="task-due-date">{t("dueDateLabel")}</FieldLabel>
        <Input
          id="task-due-date"
          type="date"
          {...register("dueDate")}
          aria-invalid={showError("dueDate")}
        />
        {showError("dueDate") && (
          <FieldError>{errors.dueDate!.message}</FieldError>
        )}
      </Field>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {t("cancel")}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? <Spinner />
            : task
              ? t("submitEdit")
              : t("submit")}
        </Button>
      </DialogFooter>
    </form>
  );
}

function PriorityOption({
  value,
  label,
  badgeClassName,
}: {
  value: number;
  label: string;
  badgeClassName: string;
}) {
  return (
    <label className="border-border/60 hover:border-primary/50 hover:bg-primary/5 flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 transition-colors has-data-checked:border-primary has-data-checked:bg-primary/5">
      <RadioGroupItem value={String(value)} />
      <span className={cn("size-2.5 shrink-0 rounded-full", badgeClassName)} />
      <span className="text-sm font-medium">{label}</span>
    </label>
  );
}