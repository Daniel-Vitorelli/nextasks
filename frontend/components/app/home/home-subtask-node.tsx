"use client";

import { useTranslations } from "next-intl";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { Subtask } from "@/types/domain";

interface HomeSubtaskNodeProps {
  subtask: Subtask;
  depth: number;
  onToggleDone: (subtask: Subtask, done: boolean) => void;
}

/** Sub-tarefa da tarefa atual: árvore simplificada, apenas com checkbox. */
export function HomeSubtaskNode({
  subtask,
  depth,
  onToggleDone,
}: HomeSubtaskNodeProps) {
  const t = useTranslations("dashboard.tasks.subtasks");

  return (
    <li>
      <div className="relative pl-6">
        {depth > 0 && (
          <span
            aria-hidden
            className="bg-border/70 absolute bottom-0 left-0 top-0 w-px"
          />
        )}

        {depth > 0 && (
          <span
            aria-hidden
            className="bg-border/70 absolute left-0 top-4 h-px w-6 -translate-y-1/2"
          />
        )}

        <div className="flex items-start gap-1.5 rounded-md py-1.5 pr-1.5">
          <Checkbox
            checked={subtask.done}
            onCheckedChange={(checked) =>
              onToggleDone(subtask, checked === true)
            }
            aria-label={
              subtask.done ? t("toggleDone.undo") : t("toggleDone.do")
            }
            className="mt-0.5 shrink-0"
          />

          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "truncate text-sm font-medium",
                subtask.done && "text-muted-foreground line-through",
              )}
            >
              {subtask.title}
            </p>
            {subtask.description && (
              <p className="text-muted-foreground line-clamp-2 text-xs">
                {subtask.description}
              </p>
            )}
          </div>
        </div>

        {subtask.children.length > 0 && (
          <ul>
            {subtask.children.map((child) => (
              <HomeSubtaskNode
                key={child.id}
                subtask={child}
                depth={depth + 1}
                onToggleDone={onToggleDone}
              />
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}