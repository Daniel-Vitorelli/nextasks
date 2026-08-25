"use client";

import { useTranslations } from "next-intl";
import { MoreHorizontal, Trash2, Edit, CheckCircle2 } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import type { Habit } from "@/types/domain";
import { parseHabitDaysOfWeek } from "@/types/domain";
import { LUCIDE_ICON_MAP } from "@/lib/lucide-icons";
import {
  blockTextClass,
  blockTintClass,
} from "@/components/connections/connection-colors";
import { eventColorStyles } from "@/components/calendar/calendar-event-color";

interface HabitCardProps {
  habit: Habit;
  onEdit: (habit: Habit) => void;
  onDelete: (habit: Habit) => void;
}

export function HabitCard({ habit, onEdit, onDelete }: HabitCardProps) {
  const t = useTranslations("dashboard.habits");
  const IconComponent = LUCIDE_ICON_MAP[habit.icon] || CheckCircle2;
  const daysOfWeek = parseHabitDaysOfWeek(habit);

  const frequencyText =
    habit.type === "bad"
      ? t("frequency.everyday")
      : habit.frequency === "daily"
        ? t("frequency.daily", {
            days: daysOfWeek.map((d) => t(`weekdayShort_${d}`)).join(", "),
          })
        : t("frequency.weekly");

  return (
    <div
      className={`group relative flex items-start gap-4 rounded-xl border border-border/60 p-4 transition-all hover:shadow-md ${
        eventColorStyles[habit.color]?.borderHover ?? ""
      }`}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${blockTintClass(habit.color)}`}
      >
        <IconComponent className={`size-5 ${blockTextClass(habit.color)}`} />
      </div>

      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <h3 className="flex items-center gap-2 font-medium">
              <span className="truncate">{habit.name}</span>
              {habit.type === "bad" && (
                <span className="bg-destructive/10 text-destructive shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                  {t("badgeBad")}
                </span>
              )}
            </h3>
            <p className="text-xs text-muted-foreground">
              {frequencyText}
            </p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 transition-opacity md:opacity-0 md:group-hover:opacity-100"
                aria-label={t("actions.more")}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(habit)}>
                <Edit className="size-4 mr-2" />
                {t("actions.edit")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(habit)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="size-4 mr-2" />
                {t("actions.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {habit.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {habit.description}
          </p>
        )}
      </div>
    </div>
  );
}
