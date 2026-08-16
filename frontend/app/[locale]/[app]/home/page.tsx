"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CalendarClock, TrendingUp } from "lucide-react";

import { useSession } from "@/components/app/session-provider";
import { Spinner } from "@/components/ui/spinner";
import { CurrentBlockCard } from "@/components/app/home/current-block-card";
import { EmptyStateCard } from "@/components/app/home/empty-state-card";
import { PeriodSelector } from "@/components/app/home/period-selector";
import { ProgressChart } from "@/components/app/home/progress-chart";
import { TasksSection } from "@/components/app/home/tasks-section";
import { useCurrentBlock } from "@/hooks/use-current-block";
import { useRoutineProgress } from "@/hooks/use-routine-progress";

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

  const { current, isLoading, removeBlock } = useCurrentBlock();
  const [selectedDays, setSelectedDays] = useState(DEFAULT_DAYS);

  const {
    data: progress,
    isLoading: isProgressLoading,
    error: progressError,
    refetch: refetchProgress,
  } = useRoutineProgress(selectedDays);

  const blocks = current?.blocks ?? [];
  const routine = current?.routine ?? progress?.routine ?? null;
  const isPageLoading = isLoading || isProgressLoading;
  const showProgressChart = !!progress && progress.confirmableBlockCount > 0;
  const isInitialLoading = !current && !progress && (isLoading || isProgressLoading);
  const showMergedEmpty =
    !!routine &&
    !!progress &&
    !progressError &&
    !showProgressChart &&
    blocks.length === 0;

  // Períodos do seletor limitados aos dias registrados: sem histórico
  // suficiente, opções maiores que o registro não fazem sentido.
  const maxAvailablePeriod = Math.max(
    ...[7, 15, 30, 60].filter((days) => days <= (progress?.daysWithRecords ?? 0)),
    0,
  );
  const effectiveDays =
    maxAvailablePeriod > 0
      ? Math.min(selectedDays, maxAvailablePeriod)
      : selectedDays;

  const handleConfirmed = (blockId: string) => {
    removeBlock(blockId);
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

      {isInitialLoading ? (
        <section>
          <div className="flex h-64 items-center justify-center rounded-xl border border-border/60 bg-card">
            <Spinner />
          </div>
        </section>
      ) : !isPageLoading && !routine ? (
        <section>
          <EmptyStateCard
            icon={<CalendarClock />}
            title={t("noActiveRoutine.title")}
            description={t("noActiveRoutine.description")}
          />
        </section>
      ) : showMergedEmpty ? (
        <section>
          <EmptyStateCard
            icon={<CalendarClock />}
            title={t("emptyRoutine.title")}
            description={t("emptyRoutine.description")}
          />
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
                  value={effectiveDays}
                  onChange={setSelectedDays}
                  maxDays={progress?.daysWithRecords}
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
              <EmptyStateCard
                icon={<TrendingUp />}
                title={t("progressChart.emptyTitle")}
                description={t("progressChart.emptyDescription")}
              />
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

            {blocks.length > 0 && routine ? (
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
              <EmptyStateCard
                icon={<CalendarClock />}
                title={t("currentBlock.emptyTitle")}
                description={t("currentBlock.emptyDescription")}
              />
            )}
          </section>
        </>
      )}

      <TasksSection />
    </main>
  );
}
