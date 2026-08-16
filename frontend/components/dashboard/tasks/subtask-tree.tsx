"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";

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
import { SubtaskDialog } from "@/components/dashboard/tasks/subtask-dialog";
import {
  completeAncestors,
  markSubtreeDone,
  removeAndRecomplete,
} from "@/lib/subtask-tree";
import { useSubtasks } from "@/hooks/use-subtasks";
import type { Subtask, SubtaskFormValues } from "@/types/domain";
import { SubtaskNode } from "./subtask-node";

interface SubtaskTreeProps {
  taskId: string;
  taskTitle: string;
  onTaskDoneChange?: (done: boolean) => void;
}

export function SubtaskTree({
  taskId,
  taskTitle,
  onTaskDoneChange,
}: SubtaskTreeProps) {
  const t = useTranslations("dashboard.tasks.subtasks");
  const {
    subtasks,
    isLoading,
    createSubtask,
    updateSubtask,
    toggleSubtaskDone,
    deleteSubtask,
  } = useSubtasks(taskId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSubtask, setEditingSubtask] = useState<Subtask | null>(null);
  const [createParent, setCreateParent] = useState<Subtask | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Subtask | null>(null);

  const openCreateDialog = (parent: Subtask | null) => {
    setEditingSubtask(null);
    setCreateParent(parent);
    setDialogOpen(true);
  };

  const openEditDialog = (subtask: Subtask) => {
    setEditingSubtask(subtask);
    setCreateParent(null);
    setDialogOpen(true);
  };

  const handleSave = async (values: SubtaskFormValues) => {
    if (editingSubtask) {
      await updateSubtask(editingSubtask.id, values);
    } else {
      await createSubtask(values, createParent?.id ?? null);
      // Nova sub-tarefa nasce desmarcada: a tarefa não pode seguir concluída.
      onTaskDoneChange?.(false);
    }
  };

  const handleDelete = async () => {
    if (deleteTarget) {
      await deleteSubtask(deleteTarget.id);
      setDeleteTarget(null);
      // Excluir o último filho pendente pode concluir a tarefa.
      const updated = removeAndRecomplete(subtasks, deleteTarget.id);
      if (updated) {
        onTaskDoneChange?.(updated.every((root) => root.done));
      }
    }
  };

  const handleToggleDone = (item: Subtask, done: boolean) => {
    void toggleSubtaskDone(item.id, done);
    if (!done) {
      // Reabrir qualquer sub-tarefa reabre a tarefa.
      onTaskDoneChange?.(false);
      return;
    }
    // Concluir o último filho pendente conclui a tarefa: aplica a mesma
    // cascata no estado atual e verifica se todas as raízes ficaram feitas.
    const updated = completeAncestors(markSubtreeDone(subtasks, item.id), item.id);
    onTaskDoneChange?.(
      updated.length > 0 && updated.every((root) => root.done),
    );
  };

  const parentTitle = createParent?.title ?? taskTitle;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-jetbrainsMono text-xs text-muted-foreground uppercase tracking-[0.2em]">
          {t("title")}
        </p>
        <Button size="sm" variant="outline" onClick={() => openCreateDialog(null)}>
          <Plus />
          {t("create")}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Spinner className="size-5" />
        </div>
      ) : subtasks.length === 0 ? (
        <div className="bg-muted/50 text-muted-foreground rounded-lg border border-dashed px-4 py-6 text-center text-sm">
          {t("empty")}
        </div>
      ) : (
        <ul>
          <li>
            <div className="relative pl-6">
              <div className="flex items-center gap-1.5 rounded-md py-1.5 pr-1.5">
                <p className="truncate text-sm font-semibold">{taskTitle}</p>
              </div>

              <ul>
                {subtasks.map((subtask) => (
                  <SubtaskNode
                    key={subtask.id}
                    subtask={subtask}
                    depth={1}
                    onAddChild={openCreateDialog}
                    onEdit={openEditDialog}
                    onDelete={setDeleteTarget}
                    onToggleDone={(item, done) => {
                      handleToggleDone(item, done);
                    }}
                  />
                ))}
              </ul>
            </div>
          </li>
        </ul>
      )}

      <SubtaskDialog
        open={dialogOpen}
        parentTitle={parentTitle}
        subtask={editingSubtask}
        onOpenChange={setDialogOpen}
        onSave={handleSave}
      />

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
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDelete()}
              className="bg-destructive text-white hover:bg-destructive/80"
            >
              {t("deleteDialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}