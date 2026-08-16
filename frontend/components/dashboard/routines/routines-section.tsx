"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronUp, ListTodo, Plus } from "lucide-react";

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
import { RoutineCard } from "@/components/dashboard/routines/routine-card";
import { RoutineCalendarDialog } from "@/components/dashboard/routines/routine-calendar-dialog";
import { RoutineDialog } from "@/components/dashboard/routines/routine-dialog";
import type { Routine, RoutineFormValues } from "@/types/domain";
import { useRoutines } from "@/hooks/use-routines";

const INITIAL_VISIBLE = 2;

export function RoutinesSection() {
  const t = useTranslations("dashboard.routines");
  const {
    routines,
    isLoading,
    isDeleting,
    saveRoutine,
    duplicateRoutine,
    toggleActiveRoutine,
    deleteRoutine,
  } = useRoutines();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Routine | null>(null);
  const [openRoutine, setOpenRoutine] = useState<Routine | null>(null);
  const [showAll, setShowAll] = useState(false);

  const openCreateDialog = () => {
    setEditingRoutine(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (routine: Routine) => {
    setEditingRoutine(routine);
    setIsDialogOpen(true);
  };

  const handleSave = (values: RoutineFormValues) =>
    saveRoutine(values, editingRoutine);

  const handleDelete = async () => {
    await deleteRoutine(deleteTarget);
    setDeleteTarget(null);
  };

  const visibleRoutines = showAll
    ? routines
    : routines.slice(0, INITIAL_VISIBLE);

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

      <RoutineDialog
        open={isDialogOpen}
        routine={editingRoutine}
        onOpenChange={setIsDialogOpen}
        onSave={handleSave}
      />

      <RoutineCalendarDialog
        routine={openRoutine}
        open={!!openRoutine}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setOpenRoutine(null);
          }
        }}
      />

      {isLoading ? (
        <LoadingState />
      ) : routines.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <ul className="space-y-3">
            {visibleRoutines.map((routine) => (
              <RoutineCard
                key={routine.id}
                routine={routine}
                onOpen={setOpenRoutine}
                onEdit={openEditDialog}
                onDelete={setDeleteTarget}
                onDuplicate={(item) =>
                  duplicateRoutine(item, t("actions.duplicateSuffix"))
                }
                onToggleActive={toggleActiveRoutine}
              />
            ))}
          </ul>

          {routines.length > INITIAL_VISIBLE && (
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
                    {t("showAll", { count: routines.length })}
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
                name: deleteTarget?.name ?? "",
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
  const t = useTranslations("dashboard.routines");

  return (
    <div className="border-border/60 flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center">
      <div className="bg-muted flex size-12 items-center justify-center rounded-full">
        <ListTodo className="text-muted-foreground" />
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
