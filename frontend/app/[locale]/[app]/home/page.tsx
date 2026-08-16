"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CalendarClock, TrendingUp } from "lucide-react";

import { useSession } from "@/components/session-provider";
import { Spinner } from "@/components/ui/spinner";
import { CurrentBlockCard } from "@/components/app/home/current-block-card";
import { PeriodSelector } from "@/components/app/home/period-selector";
import { ProgressChart } from "@/components/app/home/progress-chart";
import { TasksSection } from "@/components/app/home/tasks-section";
import { useRoutineProgress } from "@/components/app/home/use-routine-progress";
import type { Period, TimeBlock, Routine } from "@/types/domain";

interface CurrentBlockResponse {
  routine: Routine | null;
  blocks: TimeBlock[];
  period: Period | null;
}

const REFRESH_INTERVAL_MS = 60_000;
const DEFAULT_DAYS = 30;

export default function HomePage() {
  const t = useTranslations("app.home");
  const { user } = useSession() ?? {};
  const locale = useLocale();

  const firstName = user?.name?.split(" ")[0];

  const dateLabel = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  const timeFormatter = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
  });

  const tzOffsetMinutes = new Date().getTimezoneOffset();

  const [current, setCurrent] = useState<CurrentBlockResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDays, setSelectedDays] = useState(DEFAULT_DAYS);

  const {
    data: progress,
    isLoading: isProgressLoading,
    error: progressError,
    refetch: refetchProgress,
  } = useRoutineProgress(selectedDays);

  const loadCurrentBlock = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/routines/current-block?tzOffset=${tzOffsetMinutes}`,
      );

      if (!response.ok) {
        throw new Error("Failed to load current block");
      }

      setCurrent((await response.json()) as CurrentBlockResponse);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [tzOffsetMinutes]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void loadCurrentBlock();
    const interval = setInterval(loadCurrentBlock, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadCurrentBlock]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const blocks = current?.blocks ?? [];
  const routine = current?.routine ?? progress?.routine ?? null;
  const isPageLoading = isLoading || isProgressLoading;
  const showProgressChart = !!progress && progress.confirmableBlockCount > 0;

  const handleConfirmed = (blockId: string) => {
    setCurrent((state) =>
      state
        ? {
            ...state,
            blocks: state.blocks.filter((block) => block.id !== blockId),
          }
        : state,
    );
    void refetchProgress();
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-12 px-4 py-12 md:px-8">
      <header className="space-y-1.5">
        <p className="font-jetbrainsMono text-sm text-muted-foreground uppercase tracking-[0.2em]">
          {t("eyebrow")}
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {t("greeting", { name: firstName ?? t("fallbackName") })}
        </h1>
        <p className="text-muted-foreground capitalize">{dateLabel}</p>
      </header>

      {!isPageLoading && !routine ? (
        <section>
          <div className="flex items-center gap-4 rounded-xl border border-dashed border-border/60 bg-card/50 p-5">
            <CalendarClock className="text-muted-foreground size-6 shrink-0" />
            <div className="flex flex-col gap-0.5">
              <h2 className="font-semibold">
                {t("noActiveRoutine.title")}
              </h2>
              <p className="text-muted-foreground text-sm">
                {t("noActiveRoutine.description")}
              </p>
            </div>
          </div>
        </section>
      ) : (
        <>
          <section className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="space-y-0.5">
                <p className="font-jetbrainsMono text-xs text-muted-foreground uppercase tracking-[0.2em]">
                  {t("progressChart.title")}
                </p>
                <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                  {t("progressChart.subtitle")}
                </h2>
              </div>
              {showProgressChart && (
                <PeriodSelector
                  value={selectedDays}
                  onChange={setSelectedDays}
                />
              )}
            </div>

            {isProgressLoading ? (
              <div className="flex h-64 items-center justify-center rounded-xl border border-border/60 bg-card">
                <Spinner />
              </div>
            ) : progressError ? (
              <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50">
                <p className="text-sm text-muted-foreground">{progressError}</p>
              </div>
            ) : !progress || progress.confirmableBlockCount === 0 ? (
              <div className="flex items-center gap-4 rounded-xl border border-dashed border-border/60 bg-card/50 p-5">
                <TrendingUp className="text-muted-foreground size-6 shrink-0" />
                <div className="flex flex-col gap-0.5">
                  <h2 className="font-semibold">
                    {t("progressChart.emptyTitle")}
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    {t("progressChart.emptyDescription")}
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-border/60 bg-card p-4">
                <ProgressChart
                  data={progress.progress}
                  locale={locale}
                  className="h-64"
                />
              </div>
            )}
          </section>

          <section className="space-y-3">
            <p className="font-jetbrainsMono text-xs text-muted-foreground uppercase tracking-[0.2em]">
              {t("currentBlock.label")}
            </p>

            {isLoading && !current ? (
              <div className="flex items-center justify-center rounded-xl border border-border/60 bg-card p-8">
                <Spinner />
              </div>
            ) : blocks.length > 0 && routine ? (
              <ul className="space-y-3">
                {blocks.map((block) => (
                  <CurrentBlockCard
                    key={block.id}
                    block={block}
                    routineName={routine.name}
                    timeFormatter={timeFormatter}
                    tzOffsetMinutes={tzOffsetMinutes}
                    onConfirmed={handleConfirmed}
                  />
                ))}
              </ul>
            ) : (
              <div className="flex items-center gap-4 rounded-xl border border-dashed border-border/60 bg-card/50 p-5">
                <CalendarClock className="text-muted-foreground size-6 shrink-0" />
                <div className="flex flex-col gap-0.5">
                  <h2 className="font-semibold">
                    {t("currentBlock.emptyTitle")}
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    {t("currentBlock.emptyDescription")}
                  </p>
                </div>
              </div>
            )}
          </section>

          <TasksSection />
        </>
      )}
    </main>
  );
}
