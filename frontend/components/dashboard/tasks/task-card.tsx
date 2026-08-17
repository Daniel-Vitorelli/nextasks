"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  CalendarClock,
  CircleEllipsis,
  Copy,
  Info,
  Pencil,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { priorityBadgeStyles } from "@/components/dashboard/tasks/task-priority";
import { cn } from "@/lib/utils";
import type { Task } from "@/types/domain";

interface TaskCardProps {
  task: Task;
  onDetails: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onDuplicate: (task: Task) => void;
  onToggleDone: (task: Task) => void;
}

export function TaskCard({
  task,
  onDetails,
  onEdit,
  onDelete,
  onDuplicate,
  onToggleDone,
}: TaskCardProps) {
  const t = useTranslations("dashboard.tasks");
  const locale = useLocale();

  const handleDetails = (event: React.MouseEvent) => {
    event.stopPropagation();
    onDetails(task);
  };

  const handleEdit = (event: React.MouseEvent) => {
    event.stopPropagation();
    onEdit(task);
  };

  const handleDuplicate = (event: React.MouseEvent) => {
    event.stopPropagation();
    onDuplicate(task);
  };

  const handleDelete = (event: React.MouseEvent) => {
    event.stopPropagation();
    onDelete(task);
  };

  const handleToggleDone = () => onToggleDone(task);

  return (
    <li
      className={cn(
        "border-border/60 flex items-start gap-3 rounded-xl border bg-card p-4 transition-colors",
        task.done && "opacity-60",
      )}
    >
      <Checkbox
        checked={task.done}
        onCheckedChange={handleToggleDone}
        aria-label={t("actions.toggleDone")}
        className="mt-0.5"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <h3
          className={cn(
            "truncate font-medium",
            task.done && "text-muted-foreground line-through",
          )}
        >
          {task.title}
        </h3>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
              priorityBadgeStyles[task.priority],
            )}
          >
            {t(`priority_${task.priority}`)}
          </span>
          {task.dueDate && (
            <span className="bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs">
              <CalendarClock className="size-3" />
              {new Intl.DateTimeFormat(locale).format(new Date(task.dueDate))}
            </span>
          )}
          {task.done && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              <CircleEllipsis className="size-3" />
              {t("done")}
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={handleDetails}
              aria-label={t("actions.more")}
            >
              <Info />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t("actions.more")}</p>
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
              onClick={handleDuplicate}
              aria-label={t("actions.duplicate")}
            >
              <Copy />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t("actions.duplicate")}</p>
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
    </li>
  );
}