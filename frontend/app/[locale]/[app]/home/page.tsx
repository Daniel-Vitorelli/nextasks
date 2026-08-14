"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CalendarClock, Clock } from "lucide-react";

import { useSession } from "@/components/session-provider";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { eventColorStyles } from "@/components/calendar/calendar-event-color";
import type { TimeBlock } from "@/lib/time-blocks";
import type { Routine } from "@/lib/routines";

interface CurrentBlockResponse {
  routine: Routine | null;
  blocks: TimeBlock[];
}

const REFRESH_INTERVAL_MS = 60_000;

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

  const [current, setCurrent] = useState<CurrentBlockResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadCurrentBlock = async () => {
    try {
      const response = await fetch("/api/routines/current-block");

      if (!response.ok) {
        throw new Error("Failed to load current block");
      }

      setCurrent((await response.json()) as CurrentBlockResponse);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void loadCurrentBlock();
    const interval = setInterval(loadCurrentBlock, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const blocks = current?.blocks ?? [];
  const routine = current?.routine ?? null;

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
            {blocks.map((block) => {
              const colorStyles = eventColorStyles[block.color];
              return (
                <li
                  key={block.id}
                  className={cn(
                    "flex items-center gap-4 rounded-xl border border-border/60 bg-card p-5 transition-colors",
                    colorStyles?.bgHover,
                  )}
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <h2 className="truncate text-xl font-semibold tracking-tight">
                      {block.title}
                    </h2>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="size-4" />
                      {block.isAllDay
                        ? t("currentBlock.allDay")
                        : `${timeFormatter.format(new Date(block.start))} – ${timeFormatter.format(new Date(block.end))}`}
                    </div>
                    {block.description && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {block.description}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 text-xs capitalize">
                      {routine.name}
                    </span>
                    {colorStyles && (
                      <span
                        className={cn(
                          "size-2.5 rounded-full",
                          colorStyles.border,
                        )}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flex items-center gap-4 rounded-xl border border-dashed border-border/60 bg-card/50 p-5">
            <CalendarClock className="text-muted-foreground size-6 shrink-0" />
            <div className="flex flex-col gap-0.5">
              <h2 className="font-semibold">
                {routine
                  ? t("currentBlock.emptyTitle")
                  : t("currentBlock.noRoutineTitle")}
              </h2>
              <p className="text-muted-foreground text-sm">
                {routine
                  ? t("currentBlock.emptyDescription")
                  : t("currentBlock.noRoutineDescription")}
              </p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
