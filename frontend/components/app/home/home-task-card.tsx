"use client";

import { useTranslations } from "next-intl";
import { CalendarClock, CircleEllipsis } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { priorityBadgeStyles } from "@/components/dashboard/tasks/task-priority";
import { cn } from "@/lib/utils";
import type { Task } from "@/types/domain";

interface HomeTaskCardProps {
  task: Task;
  onToggleDone: (task: Task) => void;
}

/** Card da tarefa atual: mesmas informações do painel, sem ações de edição. */
export function HomeTaskCard({ task, onToggleDone }: HomeTaskCardProps) {
  const t = useTranslations("dashboard.tasks");

  return (
    <div className="border-border/60 flex items-start gap-3 rounded-xl border bg-card p-4 transition-colors">
      <Checkbox
        checked={task.done}
        onCheckedChange={() => onToggleDone(task)}
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
              {new Date(task.dueDate).toLocaleDateString()}
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
    </div>
  );
}