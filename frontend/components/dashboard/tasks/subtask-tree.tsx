"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  ChevronDown,
  ChevronRight,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Spinner } from "@/components/ui/spinner";
import { Checkbox } from "@/components/ui/checkbox";
import { SubtaskDialog } from "@/components/dashboard/tasks/subtask-dialog";
import { useSubtasks } from "@/components/dashboard/tasks/use-subtasks";
import { cn } from "@/lib/utils";
import type { Subtask, SubtaskFormValues } from "@/types/domain";

interface SubtaskTreeProps {
  taskId: string;
  taskTitle: string;
}

export function SubtaskTree({ taskId, taskTitle }: SubtaskTreeProps) {
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
    }
  };

  const handleDelete = async () => {
    if (deleteTarget) {
      await deleteSubtask(deleteTarget.id);
      setDeleteTarget(null);
    }
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
                    onToggleDone={(item, done) =>
                      void toggleSubtaskDone(item.id, done)
                    }
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

interface SubtaskNodeProps {
  subtask: Subtask;
  depth: number;
  onAddChild: (parent: Subtask) => void;
  onEdit: (subtask: Subtask) => void;
  onDelete: (subtask: Subtask) => void;
  onToggleDone: (subtask: Subtask, done: boolean) => void;
}

function SubtaskNode({
  subtask,
  depth,
  onAddChild,
  onEdit,
  onDelete,
  onToggleDone,
}: SubtaskNodeProps) {
  const t = useTranslations("dashboard.tasks.subtasks");
  const [expanded, setExpanded] = useState(true);
  const hasChildren = subtask.children.length > 0;

  return (
    <li>
      {/* Contêiner indentado: linha-guia vertical na borda esquerda (depth * 24px) percorrendo linha + sub-árvore. */}
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

        <div className="group/row flex items-start gap-1.5 rounded-md py-1.5 pr-1.5 transition-colors hover:bg-muted/50">
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

            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              disabled={!hasChildren}
              aria-expanded={hasChildren ? expanded : undefined}
              aria-label={hasChildren ? t("collapseExpand") : undefined}
              className="text-muted-foreground mt-px flex size-4 shrink-0 items-center justify-center disabled:invisible"
            >
              {hasChildren && (expanded ? <ChevronDown /> : <ChevronRight />)}
            </button>

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

            <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/row:opacity-100">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    onClick={() => onAddChild(subtask)}
                    aria-label={t("addChild")}
                  >
                    <Plus />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t("addChild")}</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    onClick={() => onEdit(subtask)}
                    aria-label={t("edit")}
                  >
                    <Pencil />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t("edit")}</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    onClick={() => onDelete(subtask)}
                    aria-label={t("delete")}
                  >
                    <Trash2 className="text-destructive" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t("delete")}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

        {hasChildren && expanded && (
          <ul>
            {subtask.children.map((child) => (
              <SubtaskNode
                key={child.id}
                subtask={child}
                depth={depth + 1}
                onAddChild={onAddChild}
                onEdit={onEdit}
                onDelete={onDelete}
                onToggleDone={onToggleDone}
              />
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}