"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Target, Plus, Calendar } from "lucide-react";

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
import { HabitCard } from "@/components/dashboard/habits/habit-card";
import { HabitDialog } from "@/components/dashboard/habits/habit-dialog";
import type { Habit, HabitFormValues, HabitPayload } from "@/types/domain";
import { useHabits } from "@/hooks/use-habits";
import { useTzOffset } from "@/lib/client/use-tz-offset";

const INITIAL_VISIBLE = 3;

export function HabitsSection() {
  const t = useTranslations("dashboard.habits");
  const tzOffset = useTzOffset();
  const {
    habits,
    isLoading,
    isDeleting,
    saveHabit,
    deleteHabit,
  } = useHabits(tzOffset);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Habit | null>(null);
  const [showAll, setShowAll] = useState(false);

  const openCreateDialog = () => {
    setEditingHabit(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (habit: Habit) => {
    setEditingHabit(habit);
    setIsDialogOpen(true);
  };

  const handleSave = (values: HabitFormValues) =>
    saveHabit(
      {
        ...values,
        daysOfWeek: JSON.stringify(values.daysOfWeek),
      } as HabitPayload,
      editingHabit,
    );

  const handleDelete = async () => {
    await deleteHabit(deleteTarget);
    setDeleteTarget(null);
  };

  const visibleHabits = showAll ? habits : habits.slice(0, INITIAL_VISIBLE);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Target className="size-5" />
            {t("title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>

        <Button onClick={openCreateDialog}>
          <Plus />
          {t("create")}
        </Button>
      </div>

      <HabitDialog
        open={isDialogOpen}
        habit={editingHabit}
        onOpenChange={setIsDialogOpen}
        onSave={handleSave}
      />

      {isLoading ? (
        <LoadingState />
      ) : habits.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <ul className="space-y-3">
            {visibleHabits.map((habit) => (
              <HabitCard
                key={habit.id}
                habit={habit}
                onEdit={openEditDialog}
                onDelete={setDeleteTarget}
              />
            ))}
          </ul>

          {habits.length > INITIAL_VISIBLE && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => setShowAll((value) => !value)}
              >
                <Calendar className="size-4 mr-2" />
                {showAll ? t("showLess") : t("showAll", { count: habits.length })}
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
  const t = useTranslations("dashboard.habits");

  return (
    <div className="border-border/60 flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center">
      <div className="bg-muted flex size-12 items-center justify-center rounded-full">
        <Target className="text-muted-foreground" />
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
