"use client";

import { useTranslations } from "next-intl";
import { ListChecks } from "lucide-react";

import { Spinner } from "@/components/ui/spinner";
import { useTasks } from "@/hooks/use-tasks";
import { useSubtasks } from "@/hooks/use-subtasks";
import {
  completeAncestors,
  markSubtreeDone,
} from "@/lib/subtask-tree";
import { sortPendingTasks } from "@/lib/task-ordering";
import type { Subtask, Task } from "@/types/domain";
import { HomeSubtaskNode } from "./home-subtask-node";
import { HomeTaskCard } from "./home-task-card";
import { UpcomingTaskRow } from "./upcoming-task-row";

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
          <HomeTaskCard task={current} onToggleDone={toggleTaskDone} />

          {subtasks.length > 0 && (
            <div className="rounded-xl border border-border/60 bg-card p-4">
              <p className="font-jetbrainsMono text-xs text-muted-foreground uppercase tracking-[0.2em]">
                {t("subtasksLabel")}
              </p>
              <ul className="mt-2">
                {subtasks.map((subtask) => (
                  <HomeSubtaskNode
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