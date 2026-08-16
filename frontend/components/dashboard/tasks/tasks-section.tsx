"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronUp, ListChecks, Plus } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { TaskCard } from "@/components/dashboard/tasks/task-card";
import { TaskDetailsDialog } from "@/components/dashboard/tasks/task-details-dialog";
import { TaskDialog } from "@/components/dashboard/tasks/task-dialog";
import { useTasks } from "@/components/dashboard/tasks/use-tasks";
import type { Task, TaskFormValues } from "@/types/domain";

const INITIAL_VISIBLE = 2;

export function TasksSection() {
  const t = useTranslations("dashboard.tasks");
  const {
    tasks,
    isLoading,
    isDeleting,
    saveTask,
    toggleTaskDone,
    setTaskDone,
    duplicateTask,
    deleteTask,
  } = useTasks();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [detailsTask, setDetailsTask] = useState<Task | null>(null);
  const [showAll, setShowAll] = useState(false);

  const openCreateDialog = () => {
    setEditingTask(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (task: Task) => {
    setEditingTask(task);
    setIsDialogOpen(true);
  };

  const handleSave = (values: TaskFormValues) => saveTask(values, editingTask);

  const handleDelete = async () => {
    await deleteTask(deleteTarget);
    setDeleteTarget(null);
  };

  // Concluir/reabrir sub-tarefas pode concluir/reabrir a tarefa pai
  // (invariante de conclusão).
  const handleTaskDoneChange = (taskId: string, done: boolean) => {
    setTaskDone(taskId, done);
    setDetailsTask((current) =>
      current && current.id === taskId ? { ...current, done } : current,
    );
  };

  const visibleTasks = showAll ? tasks : tasks.slice(0, INITIAL_VISIBLE);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>

        <Button onClick={openCreateDialog}>
          <Plus />
          {t("create")}
        </Button>
      </div>

      <TaskDialog
        open={isDialogOpen}
        task={editingTask}
        onOpenChange={setIsDialogOpen}
        onSave={handleSave}
      />

      <TaskDetailsDialog
        task={detailsTask}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setDetailsTask(null);
          }
        }}
        onTaskDoneChange={handleTaskDoneChange}
      />

      {isLoading ? (
        <LoadingState />
      ) : tasks.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <ul className="space-y-3">
            {visibleTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onDetails={setDetailsTask}
                onEdit={openEditDialog}
                onDelete={setDeleteTarget}
                onDuplicate={(item) =>
                  duplicateTask(item, t("actions.duplicateSuffix"))
                }
                onToggleDone={toggleTaskDone}
              />
            ))}
          </ul>

          {tasks.length > INITIAL_VISIBLE && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => setShowAll((value) => !value)}
              >
                {showAll ? (
                  <>
                    <ChevronUp />
                    {t("showLess")}
                  </>
                ) : (
                  <>
                    <ChevronDown />
                    {t("showAll", { count: tasks.length })}
                  </>
                )}
              </Button>
            </div>
          )}
        </>
      )}

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteDialog.description", {
                title: deleteTarget?.title ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {t("deleteDialog.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-white hover:bg-destructive/80"
            >
              {isDeleting ? <Spinner /> : t("deleteDialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-16">
      <Spinner className="size-6" />
    </div>
  );
}

function EmptyState() {
  const t = useTranslations("dashboard.tasks");

  return (
    <div className="border-border/60 flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center">
      <div className="bg-muted flex size-12 items-center justify-center rounded-full">
        <ListChecks className="text-muted-foreground" />
      </div>
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{t("empty.title")}</p>
        <p className="text-muted-foreground text-sm">
          {t("empty.description")}
        </p>
      </div>
    </div>
  );
}