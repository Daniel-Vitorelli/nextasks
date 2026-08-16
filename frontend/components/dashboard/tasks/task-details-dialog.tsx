"use client";

import { useTranslations } from "next-intl";
import { Link2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { SubtaskTree } from "@/components/dashboard/tasks/subtask-tree";
import { ConnectionPopover } from "@/components/connections/connection-popover";
import { ConnectionBadge } from "@/components/connections/connection-badge";
import { priorityBadgeStyles } from "@/components/dashboard/tasks/task-priority";
import { cn } from "@/lib/utils";
import type { Task } from "@/types/domain";

interface TaskDetailsDialogProps {
  task: Task | null;
  onOpenChange: (open: boolean) => void;
  onTaskDoneChange?: (taskId: string, done: boolean) => void;
}

export function TaskDetailsDialog({
  task,
  onOpenChange,
  onTaskDoneChange,
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
      <DialogContent
        onInteractOutside={(event) => {
          // Popover de conexões fica em portal próprio: clicar dentro dele
          // não deve fechar o diálogo de detalhes.
          const target = event.target as HTMLElement;
          if (target.closest("[data-radix-popper-content-wrapper]")) {
            event.preventDefault();
          }
        }}
      >
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

          <div className="flex items-center justify-between gap-3">
            <p className="font-jetbrainsMono text-xs text-muted-foreground uppercase tracking-[0.2em]">
              {t("details.connectionsLabel")}
            </p>
            <ConnectionPopover
              anchor={{ type: "task", id: task.id, title: task.title }}
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={t("details.connectionsOpen")}
              >
                <span className="relative">
                  <Link2 className="size-4" />
                  <ConnectionBadge
                    anchor={{ type: "task", id: task.id }}
                    className="absolute -right-2 -top-2"
                  />
                </span>
                <span className="hidden sm:inline">
                  {t("details.connectionsOpen")}
                </span>
              </Button>
            </ConnectionPopover>
          </div>

          <Separator className="my-1" />

          <SubtaskTree
            taskId={task.id}
            taskTitle={task.title}
            onTaskDoneChange={(done) => onTaskDoneChange?.(task.id, done)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}