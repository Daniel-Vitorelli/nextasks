"use client";

import { useTranslations } from "next-intl";
import { CalendarClock, CalendarRange, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Routine } from "@/lib/routines";

interface RoutineCardProps {
  routine: Routine;
  onEdit: (routine: Routine) => void;
  onDelete: (routine: Routine) => void;
}

export function RoutineCard({ routine, onEdit, onDelete }: RoutineCardProps) {
  const t = useTranslations("dashboard.routines");

  const durationLabel =
    routine.duration === "until" && routine.endDate
      ? t("dialog.untilWithDate", {
          date: new Date(routine.endDate).toLocaleDateString(),
        })
      : t("dialog.indefinite");

  return (
    <li className="border-border/60 flex flex-col gap-2 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium">{routine.name}</h3>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => onEdit(routine)}
                aria-label={t("actions.edit")}
              >
                <Pencil />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t("actions.edit")}</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => onDelete(routine)}
                aria-label={t("actions.delete")}
              >
                <Trash2 className="text-destructive" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t("actions.delete")}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs">
          <CalendarRange className="size-3" />
          {t(`dialog.${routine.frequency}`)}
        </span>
        <span className="bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs">
          <CalendarClock className="size-3" />
          {durationLabel}
        </span>
      </div>

      {routine.description && (
        <p className="text-muted-foreground text-sm">{routine.description}</p>
      )}
    </li>
  );
}