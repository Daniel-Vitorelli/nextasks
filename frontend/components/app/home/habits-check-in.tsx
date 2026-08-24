"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CalendarCheck, CheckCircle2, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Heatmap } from "@/components/app/home/heatmap";
import { StreakCard } from "@/components/app/home/streak-card";
import { LUCIDE_ICON_MAP } from "@/lib/lucide-icons";
import {
  blockTextClass,
  blockTintClass,
} from "@/components/connections/connection-colors";
import { useHabits } from "@/hooks/use-habits";
import { useHabitStats } from "@/hooks/use-habit-stats";
import { useTzOffset } from "@/lib/client/use-tz-offset";
import type { HabitWithProgress } from "@/types/domain";

/** Confirmação dos hábitos do dia: diários agendados para hoje e semanais
 *  (que podem ser marcados em qualquer dia da semana). Cada hábito expande
 *  para o próprio streak e heatmap de conclusões. */
export function HabitsCheckIn() {
  const t = useTranslations("app.home.habits");
  const locale = useLocale();
  const tzOffset = useTzOffset();
  const { habits, isLoading, completeHabit } = useHabits(tzOffset);
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
            const currentCount = Math.min(
              habit.currentCount,
              habit.targetCount,
            );
            const isComplete = currentCount >= habit.targetCount;
            const periodLabel =
              habit.frequency === "weekly"
                ? t("period.weekly")
                : t("period.daily");
            const isExpanded = expandedIds.has(habit.id);
            const habitStats = stats.get(habit.id);

            return (
              <li
                key={habit.id}
                className="border-border/60 rounded-xl border bg-card"
              >
                <div className="flex items-center gap-4 p-4">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${blockTintClass(habit.color)}`}
                  >
                    <IconComponent
                      className={`size-5 ${blockTextClass(habit.color)}`}
                    />
                  </div>

                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p
                      className={
                        isComplete
                          ? "text-muted-foreground font-medium line-through"
                          : "font-medium truncate"
                      }
                    >
                      {habit.name}
                    </p>
                    <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                      <span>
                        {currentCount} / {habit.targetCount}
                      </span>
                      <span>· {periodLabel}</span>
                    </p>
                  </div>

                  <Button
                    variant={isComplete ? "default" : "outline"}
                    size="sm"
                    disabled={isComplete || pendingId === habit.id}
                    onClick={() => void handleComplete(habit)}
                    className="gap-1.5"
                  >
                    {pendingId === habit.id ? (
                      <Spinner className="size-3.5" />
                    ) : (
                      <CheckCircle2 className="size-3.5" />
                    )}
                    {isComplete ? t("done") : t("confirm")}
                  </Button>

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
