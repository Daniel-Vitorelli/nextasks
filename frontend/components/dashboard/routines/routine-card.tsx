"use client";

import { useTranslations } from "next-intl";
import { CalendarClock, CalendarDays, CalendarRange, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Routine } from "@/lib/routines";

interface RoutineCardProps {
  routine: Routine;
  onOpen: (routine: Routine) => void;
  onEdit: (routine: Routine) => void;
  onDelete: (routine: Routine) => void;
}

export function RoutineCard({
  routine,
  onOpen,
  onEdit,
  onDelete,
}: RoutineCardProps) {
  const t = useTranslations("dashboard.routines");

  const durationLabel =
    routine.duration === "until" && routine.endDate
      ? t("dialog.untilWithDate", {
          date: new Date(routine.endDate).toLocaleDateString(),
        })
      : t("dialog.indefinite");

  const handleOpen = (event: React.MouseEvent) => {
    event.stopPropagation();
    onOpen(routine);
  };

  const handleEdit = (event: React.MouseEvent) => {
    event.stopPropagation();
    onEdit(routine);
  };

  const handleDelete = (event: React.MouseEvent) => {
    event.stopPropagation();
    onDelete(routine);
  };

  return (
    <li
      onClick={() => onOpen(routine)}
      className="border-border/60 flex cursor-pointer flex-col gap-2 rounded-xl border bg-card p-4 transition-colors hover:border-foreground/25"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium">{routine.name}</h3>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={handleOpen}
                aria-label={t("actions.calendar")}
              >
                <CalendarDays />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t("actions.calendar")}</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={handleEdit}
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
                onClick={handleDelete}
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