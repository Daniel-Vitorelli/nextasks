"use client";

import { useMemo, useState } from "react";
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
import type { Habit, HabitFormValues } from "@/types/domain";
import { createHabitSchema } from "@/schemas/habit-schema";
import { useFieldErrors } from "@/hooks/use-field-errors";
import { parseHabitDaysOfWeek } from "@/types/domain";
import { ALL_LUCIDE_ICON_NAMES, LUCIDE_ICON_MAP } from "@/lib/lucide-icons";
import { EVENT_COLORS } from "@/lib/calendar/event-constants";
import { colorSwatchClass } from "@/components/calendar/calendar-event-color";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface HabitDialogProps {
  open: boolean;
  habit: Habit | null;
  onOpenChange: (open: boolean) => void;
  onSave: (
    values: HabitFormValues,
    habit: Habit | null,
  ) => Promise<void>;
}

export function HabitDialog({
  open,
  habit,
  onOpenChange,
  onSave,
}: HabitDialogProps) {
  const t = useTranslations("dashboard.habits.dialog");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85dvh] max-w-md flex-col gap-4 overflow-hidden">
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle>{habit ? t("editTitle") : t("title")}</DialogTitle>
          <DialogDescription>
            {habit ? t("editDescription") : t("description")}
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
          <HabitForm
            key={habit?.id ?? "create"}
            habit={habit}
            onSave={onSave}
            onClose={() => onOpenChange(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface HabitFormProps {
  habit: Habit | null;
  onSave: HabitDialogProps["onSave"];
  onClose: () => void;
}

function toDefaultValues(habit: Habit | null): HabitFormValues {
  if (!habit) {
    return {
      name: "",
      description: "",
      icon: "CheckCircle2",
      color: "green",
      type: "good",
      frequency: "daily",
      daysOfWeek: [],
      targetCount: 1,
    };
  }

  return {
    name: habit.name,
    description: habit.description ?? "",
    icon: habit.icon,
    color: habit.color ?? "green",
    type: habit.type ?? "good",
    frequency: habit.frequency,
    daysOfWeek: parseHabitDaysOfWeek(habit),
    targetCount: habit.targetCount,
  };
}

function HabitForm({ habit, onSave, onClose }: HabitFormProps) {
  const t = useTranslations("dashboard.habits.dialog");
  const [iconSearch, setIconSearch] = useState("");

  const schema = useMemo(() => createHabitSchema(t), [t]);

  const {
    control,
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitted, touchedFields, isSubmitting },
  } = useForm<HabitFormValues>({
    resolver: zodResolver(schema),
    defaultValues: toDefaultValues(habit),
    mode: "onChange",
  });

  const frequency = watch("frequency");
  const habitType = watch("type");

  const showError = useFieldErrors<keyof HabitFormValues>(
    errors,
    touchedFields as Partial<Record<keyof HabitFormValues, boolean>>,
    isSubmitted,
  );

  const filteredIcons = useMemo(() => {
    const query = iconSearch.trim().toLowerCase();
    if (!query) return ALL_LUCIDE_ICON_NAMES;
    return ALL_LUCIDE_ICON_NAMES.filter((name) =>
      name.toLowerCase().includes(query),
    );
  }, [iconSearch]);

  const onSubmit = handleSubmit(async (data: HabitFormValues) => {
    try {
      await onSave(data, habit);
      onClose();
    } catch (error) {
      console.error(error);
    }
  });

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <Field className="space-y-2 gap-0" data-invalid={showError("name")}>
        <FieldLabel htmlFor="habit-name">{t("nameLabel")}</FieldLabel>
        <Input
          id="habit-name"
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
        <FieldLabel htmlFor="habit-description">
          {t("descriptionLabel")}
        </FieldLabel>
        <Textarea
          id="habit-description"
          {...register("description")}
          aria-invalid={showError("description")}
          placeholder={t("descriptionPlaceholder")}
          rows={3}
        />
        {showError("description") && (
          <FieldError>{errors.description!.message}</FieldError>
        )}
      </Field>

      <Field className="space-y-2 gap-0" data-invalid={showError("icon")}>
        <div className="flex items-center justify-between gap-2">
          <FieldLabel>{t("iconLabel")}</FieldLabel>
          <Controller
            control={control}
            name="icon"
            render={({ field }) => {
              const SelectedIcon =
                LUCIDE_ICON_MAP[field.value] ?? CheckCircle2;
              return (
                <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <SelectedIcon className="text-primary size-4" />
                  {field.value}
                </span>
              );
            }}
          />
        </div>
        <Input
          placeholder={t("iconSearchPlaceholder")}
          value={iconSearch}
          onChange={(e) => setIconSearch(e.target.value)}
        />
        <Controller
          control={control}
          name="icon"
          render={({ field }) => (
            <div className="border-border/60 h-48 overflow-y-auto rounded-lg border p-2">
              {filteredIcons.length === 0 ? (
                <p className="text-muted-foreground py-16 text-center text-sm">
                  {t("iconEmpty")}
                </p>
              ) : (
                <div className="grid grid-cols-6 gap-1.5">
                  {filteredIcons.map((name) => {
                    const Icon = LUCIDE_ICON_MAP[name];
                    const selected = field.value === name;
                    return (
                      <label
                        key={name}
                        title={name}
                        className={cn(
                          "hover:bg-primary/5 relative flex aspect-square cursor-pointer items-center justify-center rounded-lg border transition-colors has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-2",
                          selected
                            ? "border-primary bg-primary/5"
                            : "border-transparent hover:border-border",
                        )}
                      >
                        <input
                          type="radio"
                          name="habit-icon"
                          className="sr-only"
                          checked={selected}
                          onChange={() => field.onChange(name)}
                          aria-label={name}
                        />
                        <Icon
                          className={cn(
                            "size-5 transition-colors",
                            selected
                              ? "text-primary"
                              : "text-muted-foreground",
                          )}
                        />
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        />
        {showError("icon") && <FieldError>{errors.icon!.message}</FieldError>}
      </Field>

      <div className="space-y-2">
        <FieldLabel>{t("colorLabel")}</FieldLabel>
        <Controller
          control={control}
          name="color"
          render={({ field }) => (
            <div className="flex flex-wrap items-center gap-2">
              {EVENT_COLORS.map((color) => {
                const selected = color === field.value;
                return (
                  <button
                    key={color}
                    type="button"
                    className={cn(
                      "size-6 rounded-full border border-black/10 transition-transform",
                      colorSwatchClass[color],
                      selected && "ring-ring scale-110 ring-2 ring-offset-2",
                    )}
                    onClick={() => field.onChange(color)}
                    aria-label={t(`color_${color}`)}
                    aria-pressed={selected}
                  />
                );
              })}
            </div>
          )}
        />
      </div>

      <div className="space-y-2">
        <FieldLabel>{t("typeLabel")}</FieldLabel>
        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <RadioGroup
              value={field.value}
              onValueChange={field.onChange}
              className="grid grid-cols-2 gap-2"
            >
              <RadioOption
                value="good"
                id="type-good"
                label={t("typeGood")}
                description={t("typeGoodDescription")}
              />
              <RadioOption
                value="bad"
                id="type-bad"
                label={t("typeBad")}
                description={t("typeBadDescription")}
              />
            </RadioGroup>
          )}
        />
      </div>

      {habitType === "good" && (
        <>
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
                    description={t("dailyDescription")}
                  />
                  <RadioOption
                    value="weekly"
                    id="frequency-weekly"
                    label={t("weekly")}
                    description={t("weeklyDescription")}
                  />
                </RadioGroup>
              )}
            />
          </div>

          {frequency === "daily" && (
            <div className="space-y-2" data-invalid={showError("daysOfWeek")}>
              <FieldLabel>{t("daysLabel")}</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"].map(
                  (day, index) => (
                    <Controller
                      key={day}
                      control={control}
                      name="daysOfWeek"
                      render={({ field }) => {
                        const checked = field.value.includes(index);
                        return (
                          <label
                            className="border-border/60 hover:border-primary/50 hover:bg-primary/5 flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.checked
                                    ? [...field.value, index]
                                    : field.value.filter((d) => d !== index)
                                )
                              }
                              className="sr-only"
                            />
                            <span className="text-sm font-medium capitalize">{t(day)}</span>
                          </label>
                        );
                      }}
                    />
                  ))}
              </div>
              {showError("daysOfWeek") && (
                <FieldError>{errors.daysOfWeek!.message}</FieldError>
              )}
            </div>
          )}

          <div className="space-y-2">
            <FieldLabel htmlFor="habit-target-count">{t("targetCountLabel")}</FieldLabel>
            <Controller
              control={control}
              name="targetCount"
              render={({ field }) => (
                <Input
                  id="habit-target-count"
                  type="number"
                  min="1"
                  value={field.value}
                  onChange={(e) => field.onChange(Math.max(1, Number(e.target.value) || 1))}
                  className="w-24"
                  aria-invalid={showError("targetCount")}
                />
              )}
            />
            {showError("targetCount") && (
              <FieldError>{errors.targetCount!.message}</FieldError>
            )}
          </div>
        </>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {t("cancel")}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? <Spinner />
            : habit
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
  description,
}: {
  value: string;
  id: string;
  label: string;
  description?: string;
}) {
  return (
    <label className="border-border/60 hover:border-primary/50 hover:bg-primary/5 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5 flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2.5 transition-colors">
      <RadioGroupItem value={value} id={id} className="mt-0.5" />
      <div className="space-y-0.5">
        <span className="block text-sm leading-none font-medium">
          {label}
        </span>
        {description && (
          <span className="block text-xs text-muted-foreground">
            {description}
          </span>
        )}
      </div>
    </label>
  );
}