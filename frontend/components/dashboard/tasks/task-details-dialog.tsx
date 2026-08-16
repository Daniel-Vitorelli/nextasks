"use client";

import { useTranslations } from "next-intl";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { SubtaskTree } from "@/components/dashboard/tasks/subtask-tree";
import { priorityBadgeStyles } from "@/components/dashboard/tasks/task-priority";
import { cn } from "@/lib/utils";
import type { Task } from "@/types/domain";

interface TaskDetailsDialogProps {
  task: Task | null;
  onOpenChange: (open: boolean) => void;
}

export function TaskDetailsDialog({
  task,
  onOpenChange,
}: TaskDetailsDialogProps) {
  const t = useTranslations("dashboard.tasks");

  if (!task) {
    return null;
  }

  const rows: { label: string; value: string }[] = [
    {
      label: t("details.priorityLabel"),
      value: t(`priority_${task.priority}`),
    },
    ...(task.dueDate
      ? [{
          label: t("details.dueDateLabel"),
          value: new Date(task.dueDate).toLocaleDateString(undefined, {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          }),
        }]
      : []),
    {
      label: t("details.statusLabel"),
      value: task.done ? t("done") : t("open"),
    },
  ];

  return (
    <Dialog open={!!task} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 pr-8">
            {task.title}
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                priorityBadgeStyles[task.priority],
              )}
            >
              {t(`priority_${task.priority}`)}
            </span>
          </DialogTitle>
          <DialogDescription>
            {t("details.descriptionLabel")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 text-sm">
          <div className="space-y-1.5">
            <p className="font-jetbrainsMono text-xs text-muted-foreground uppercase tracking-[0.2em]">
              {t("details.descriptionLabel")}
            </p>
            <p className="text-muted-foreground">
              {task.description || t("details.noDescription")}
            </p>
          </div>

          <dl className="bg-muted/50 space-y-2 rounded-lg border p-4">
            {rows.map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between gap-4"
              >
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd className="text-right font-medium">{row.value}</dd>
              </div>
            ))}
          </dl>

          <Separator className="my-1" />

          <SubtaskTree taskId={task.id} taskTitle={task.title} />
        </div>
      </DialogContent>
    </Dialog>
  );
}