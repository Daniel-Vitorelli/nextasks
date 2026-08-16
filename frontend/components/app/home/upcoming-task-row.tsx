"use client";

import { useTranslations } from "next-intl";

import { priorityBadgeStyles } from "@/components/dashboard/tasks/task-priority";
import { cn } from "@/lib/utils";
import type { Task } from "@/types/domain";

/** Prévia simplificada de uma próxima tarefa. */
export function UpcomingTaskRow({ task }: { task: Task }) {
  const t = useTranslations("dashboard.tasks");

  return (
    <li className="border-border/60 flex items-center gap-3 rounded-lg border bg-card px-3 py-2">
      <p className="min-w-0 flex-1 truncate text-sm font-medium">
        {task.title}
      </p>
      <span
        className={cn(
          "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
          priorityBadgeStyles[task.priority],
        )}
      >
        {t(`priority_${task.priority}`)}
      </span>
      {task.dueDate && (
        <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-2 py-0.5 text-xs">
          {new Date(task.dueDate).toLocaleDateString()}
        </span>
      )}
    </li>
  );
}