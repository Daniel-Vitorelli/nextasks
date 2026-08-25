"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  RotateCcw,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Heatmap } from "@/components/app/home/heatmap";
import { StreakCard } from "@/components/app/home/streak-card";
import { LUCIDE_ICON_MAP } from "@/lib/lucide-icons";
import {
  blockTextClass,
  blockTintClass,
} from "@/components/connections/connection-colors";
import { eventColorStyles } from "@/components/calendar/calendar-event-color";
import { cn } from "@/lib/utils";
import { useHabits } from "@/hooks/use-habits";
import { useHabitStats } from "@/hooks/use-habit-stats";
import { useTzOffset } from "@/lib/client/use-tz-offset";
import type { HabitWithProgress } from "@/types/domain";

/** Confirmação dos hábitos do dia. Bons hábitos: confirmar até a meta.
 *  Ruins: registrar recaídas — dia sem registro é dia limpo, e o streak
 *  conta dias/semanas limpos consecutivos. */
export function HabitsCheckIn() {
  const t = useTranslations("app.home.habits");
  const locale = useLocale();
  const tzOffset = useTzOffset();
  const { habits, isLoading, completeHabit, undoHabit } = useHabits(tzOffset);
  const { stats, isLoading: isStatsLoading } = useHabitStats();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const todaysHabits = habits.filter((habit) => habit.isApplicableToday);

  const toggleExpanded = (habitId: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(habitId)) {
        next.delete(habitId);
      } else {
        next.add(habitId);
      }
      return next;
    });
  };

  const handleComplete = async (habit: HabitWithProgress) => {
    setPendingId(habit.id);
    try {
      await completeHabit(habit.id);
    } catch (error) {
      console.error(error);
    } finally {
      setPendingId(null);
    }
  };

  const handleUndo = async (habit: HabitWithProgress) => {
    setPendingId(habit.id);
    try {
      await undoHabit(habit.id);
    } catch (error) {
      console.error(error);
    } finally {
      setPendingId(null);
    }
  };

  return (
    <section className="space-y-3">
      <div className="space-y-0.5">
        <p className="font-jetbrainsMono text-xs text-muted-foreground uppercase tracking-[0.2em]">
          {t("title")}
        </p>
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
          {t("description")}
        </h2>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center rounded-xl border border-border/60 bg-card p-8">
          <Spinner />
        </div>
      ) : todaysHabits.length === 0 ? (
        <div className="flex items-center gap-4 rounded-xl border border-dashed border-border/60 bg-card/50 p-5">
          <CalendarCheck className="text-muted-foreground size-6 shrink-0" />
          <div className="flex flex-col gap-0.5">
            <h2 className="font-semibold">{t("emptyTitle")}</h2>
            <p className="text-muted-foreground text-sm">
              {t("emptyDescription")}
            </p>
          </div>
        </div>
      ) : (
        <ul className="space-y-2">
          {todaysHabits.map((habit) => {
            const IconComponent =
              LUCIDE_ICON_MAP[habit.icon] ?? CheckCircle2;
            const colorStyles = eventColorStyles[habit.color];
            const isBad = habit.type === "bad";
            const currentCount = habit.currentCount;
            const isComplete =
              !isBad && currentCount >= habit.targetCount;
            const slipped = isBad && currentCount > 0;
            const periodLabel =
              habit.frequency === "weekly"
                ? t("period.weekly")
                : t("period.daily");
            const isExpanded = expandedIds.has(habit.id);
            const habitStats = stats.get(habit.id);
            const isPending = pendingId === habit.id;

            return (
              <li
                key={habit.id}
                className={cn(
                  "border-border/60 rounded-xl border bg-card transition-colors",
                  colorStyles?.borderHover,
                )}
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-4">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${blockTintClass(habit.color)}`}
                  >
                    <IconComponent
                      className={`size-5 ${blockTextClass(habit.color)}`}
                    />
                  </div>

                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="flex items-center gap-1.5 font-medium">
                      <span
                        className={
                          isComplete ? "text-muted-foreground line-through" : ""
                        }
                      >
                        {habit.name}
                      </span>
                      {slipped && (
                        <XCircle className="text-destructive size-4 shrink-0" />
                      )}
                    </p>
                    <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                      {isBad ? (
                        <span>{t("relapsesCount", { count: currentCount })}</span>
                      ) : (
                        <span>
                          {currentCount} / {habit.targetCount}
                        </span>
                      )}
                      <span>· {periodLabel}</span>
                    </p>
                  </div>

                  {isBad ? (
                    <div className="flex shrink-0 items-center gap-1">
                      {slipped && (
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={isPending}
                          onClick={() => void handleUndo(habit)}
                          aria-label={t("undo")}
                        >
                          {isPending ? (
                            <Spinner className="size-4" />
                          ) : (
                            <RotateCcw className="size-4" />
                          )}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        disabled={isPending}
                        onClick={() => void handleComplete(habit)}
                        className={cn(
                          "gap-1.5",
                          colorStyles?.accentBg,
                          colorStyles?.accentBgHover,
                        )}
                      >
                        {isPending ? (
                          <Spinner className="size-3.5" />
                        ) : (
                          <XCircle className="size-3.5" />
                        )}
                        {t("logSlip")}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      disabled={isComplete || isPending}
                      onClick={() => void handleComplete(habit)}
                      className={cn(
                        "gap-1.5",
                        colorStyles?.accentBg,
                        colorStyles?.accentBgHover,
                      )}
                    >
                      {isPending ? (
                        <Spinner className="size-3.5" />
                      ) : (
                        <CheckCircle2 className="size-3.5" />
                      )}
                      {isComplete ? t("done") : t("confirm")}
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground h-8 w-8 shrink-0"
                    onClick={() => toggleExpanded(habit.id)}
                    aria-expanded={isExpanded}
                    aria-label={isExpanded ? t("hideDetails") : t("showDetails")}
                  >
                    <ChevronDown
                      className={
                        isExpanded
                          ? "rotate-180 transition-transform"
                          : "transition-transform"
                      }
                    />
                  </Button>
                </div>

                {isExpanded && (
                  <div className="space-y-3 border-border/60 border-t p-4">
                    {!habitStats && isStatsLoading ? (
                      <div className="flex justify-center py-6">
                        <Spinner />
                      </div>
                    ) : habitStats ? (
                      <>
                        <StreakCard
                          streak={habitStats.streak}
                          locale={locale}
                          accentColor={habit.color}
                        />
                        <div className="overflow-x-auto rounded-lg border border-border/60 p-3">
                          <Heatmap
                            data={habitStats.progress}
                            locale={locale}
                            tzOffsetMinutes={tzOffset}
                            color={habit.color}
                          />
                        </div>
                      </>
                    ) : null}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
