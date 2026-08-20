"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { addDays, format, startOfWeek } from "date-fns";
import { enUS, ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { WeekView } from "@/components/calendar/week-view";
import type { CalendarEvent, ViewType } from "@/types/calendar";
import type { ScheduledOccurrence } from "@/types/domain";
import { occurrenceToEvent } from "@/lib/time-blocks";
import { useTzOffset } from "@/lib/client/use-tz-offset";

export default function CalendarPage() {
  const t = useTranslations("app.calendar");
  const appLocale = useLocale();
  const dateLocale = appLocale === "pt" ? ptBR : enUS;

  const tzOffsetMinutes = useTzOffset();

  const [currentDate, setCurrentDate] = useState(() => startOfWeek(new Date()));
  const [view, setView] = useState<ViewType>("week");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSchedule = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const rangeEnd = addDays(currentDate, 6);
      const response = await fetch(
        `/api/calendar?start=${currentDate.toISOString()}&end=${rangeEnd.toISOString()}&tzOffset=${tzOffsetMinutes}`,
      );
      if (!response.ok) throw new Error("Failed to load schedule");
      const payload = (await response.json()) as { occurrences: ScheduledOccurrence[] };
      setEvents(payload.occurrences.map(occurrenceToEvent));
    } catch (error) {
      console.error(error);
      setError(t("loadError"));
    } finally {
      setIsLoading(false);
    }
  }, [currentDate, tzOffsetMinutes, t]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void loadSchedule();
  }, [loadSchedule]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const monthLabel = format(currentDate, "MMMM yyyy", { locale: dateLocale });

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-12 md:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          <p className="font-jetbrainsMono text-sm text-muted-foreground uppercase tracking-[0.2em]">
            {t("eyebrow")}
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t("title")}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            size="icon-sm"
            variant="outline"
            onClick={() => setCurrentDate((date) => addDays(date, -7))}
            aria-label={t("prevWeek")}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            onClick={() => setCurrentDate(startOfWeek(new Date()))}
          >
            {t("today")}
          </Button>
          <Button
            size="icon-sm"
            variant="outline"
            onClick={() => setCurrentDate((date) => addDays(date, 7))}
            aria-label={t("nextWeek")}
          >
            <ChevronRight className="size-4" />
          </Button>
          <div className="mx-2 min-w-32 text-center font-medium capitalize">
            {monthLabel}
          </div>
          <div className="flex items-center gap-1 rounded-md border p-0.5">
            <Button
              size="sm"
              variant={view === "week" ? "default" : "ghost"}
              onClick={() => setView("week")}
            >
              {t("weekView")}
            </Button>
            <Button
              size="sm"
              variant={view === "day" ? "default" : "ghost"}
              onClick={() => setView("day")}
            >
              {t("dayView")}
            </Button>
          </div>
        </div>
      </header>

      <div className="h-[70vh] rounded-xl border border-border/60 bg-card">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Spinner />
          </div>
        ) : error ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        ) : events.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          </div>
        ) : (
          <WeekView
            view={view}
            currentDate={currentDate}
            events={events}
            locale={dateLocale}
            className="h-full"
            onDateChange={setCurrentDate}
          />
        )}
      </div>
    </main>
  );
}