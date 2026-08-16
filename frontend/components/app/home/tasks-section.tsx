"use client";

import { useTranslations } from "next-intl";
import { CalendarClock, CircleEllipsis, ListChecks } from "lucide-react";

import { Spinner } from "@/components/ui/spinner";
import { Checkbox } from "@/components/ui/checkbox";
import { useTasks } from "@/components/dashboard/tasks/use-tasks";
import {
  completeAncestors,
  markSubtreeDone,
  useSubtasks,
} from "@/components/dashboard/tasks/use-subtasks";
import { priorityBadgeStyles } from "@/components/dashboard/tasks/task-priority";
import { sortPendingTasks } from "@/lib/task-ordering";
import { cn } from "@/lib/utils";
import type { Subtask, Task } from "@/types/domain";

const UPCOMING_LIMIT = 5;

/** Seleciona a tarefa atual entre as pendentes pela urgência combinada
 *  (prioridade + data limite) e as demais como prévia. */
function selectCurrent(tasks: Task[]): {
  current: Task | null;
  upcoming: Task[];
} {
  const sorted = sortPendingTasks(tasks.filter((task) => !task.done));
  return { current: sorted[0] ?? null, upcoming: sorted.slice(1) };
}

export function TasksSection() {
  const t = useTranslations("app.home.tasks");
  const { tasks, isLoading, toggleTaskDone, setTaskDone } = useTasks();
  const { current, upcoming } = selectCurrent(tasks);
  const { subtasks, toggleSubtaskDone } = useSubtasks(current?.id ?? null);

  const handleSubtaskToggle = (subtask: Subtask, done: boolean) => {
    if (!current) return;
    void toggleSubtaskDone(subtask.id, done);
    if (!done) {
      // Reabrir qualquer sub-tarefa reabre a tarefa.
      setTaskDone(current.id, false);
      return;
    }
    // Concluir o último filho pendente conclui a tarefa (mesma regra do painel).
    const updated = completeAncestors(
      markSubtreeDone(subtasks, subtask.id),
      subtask.id,
    );
    setTaskDone(
      current.id,
      updated.length > 0 && updated.every((root) => root.done),
    );
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-0.5">
          <p className="font-jetbrainsMono text-xs text-muted-foreground uppercase tracking-[0.2em]">
            {t("title")}
          </p>
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {t("description")}
          </h2>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center rounded-xl border border-border/60 bg-card p-8">
          <Spinner />
        </div>
      ) : !current ? (
        <div className="flex items-center gap-4 rounded-xl border border-dashed border-border/60 bg-card/50 p-5">
          <ListChecks className="text-muted-foreground size-6 shrink-0" />
          <div className="flex flex-col gap-0.5">
            <h2 className="font-semibold">{t("emptyTitle")}</h2>
            <p className="text-muted-foreground text-sm">
              {t("emptyDescription")}
            </p>
          </div>
        </div>
      ) : (
        <>
          <TaskCard task={current} onToggleDone={toggleTaskDone} />

          {subtasks.length > 0 && (
            <div className="rounded-xl border border-border/60 bg-card p-4">
              <p className="font-jetbrainsMono text-xs text-muted-foreground uppercase tracking-[0.2em]">
                {t("subtasksLabel")}
              </p>
              <ul className="mt-2">
                {subtasks.map((subtask) => (
                  <SubtaskNode
                    key={subtask.id}
                    subtask={subtask}
                    depth={1}
                    onToggleDone={handleSubtaskToggle}
                  />
                ))}
              </ul>
            </div>
          )}

          {upcoming.length > 0 && (
            <div className="space-y-2">
              <p className="font-jetbrainsMono text-xs text-muted-foreground uppercase tracking-[0.2em]">
                {t("upcomingTitle")}
              </p>
              <ul className="space-y-2">
                {upcoming.slice(0, UPCOMING_LIMIT).map((task) => (
                  <UpcomingTaskRow key={task.id} task={task} />
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

interface TaskCardProps {
  task: Task;
  onToggleDone: (task: Task) => void;
}

/** Card da tarefa atual: mesmas informações do painel, sem ações de edição. */
function TaskCard({ task, onToggleDone }: TaskCardProps) {
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

/** Prévia simplificada de uma próxima tarefa. */
function UpcomingTaskRow({ task }: { task: Task }) {
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

interface SubtaskNodeProps {
  subtask: Subtask;
  depth: number;
  onToggleDone: (subtask: Subtask, done: boolean) => void;
}

/** Sub-tarefa da tarefa atual: árvore simplificada, apenas com checkbox. */
function SubtaskNode({ subtask, depth, onToggleDone }: SubtaskNodeProps) {
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
              <SubtaskNode
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