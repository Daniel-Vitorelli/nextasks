"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { addDays, eachDayOfInterval, format, startOfWeek } from "date-fns";
import { enUS, ptBR } from "date-fns/locale";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { WeekView } from "@/components/calendar/week-view";
import type {
  CalendarEvent,
  ViewType,
} from "@/components/calendar/week-view-types";
import {
  createBlockStub,
  toCalendarEvent,
} from "@/lib/time-blocks";
import type { TimeBlock } from "@/lib/time-blocks";
import type { Routine } from "@/lib/routines";

interface RoutineCalendarDialogProps {
  routine: Routine | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Blocos de um template são armazenados com datas reais, mas exibidos de
 * forma genérica: em rotina diária o bloco sempre cai no mesmo horário do
 * dia; em rotina semanal ele cai no mesmo dia da semana (blocos repetidos).
 */
function applyTimeOfDay(target: Date, source: Date): Date {
  return new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
    source.getHours(),
    source.getMinutes(),
    source.getSeconds(),
    source.getMilliseconds(),
  );
}

export function RoutineCalendarDialog({
  routine,
  open,
  onOpenChange,
}: RoutineCalendarDialogProps) {
  const t = useTranslations("dashboard.routines");
  const appLocale = useLocale();
  const dateLocale = appLocale === "pt" ? ptBR : enUS;

  const isWeekly = routine?.frequency === "weekly";
  const weekStart = startOfWeek(new Date());

  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  /**
   * For weekly routines only: the weekday (0-6) being viewed alone, or null
   * to view the whole week. Weekly blocks are stored with real dates, and
   * the weekday of each block determines which day it belongs to.
   */
  const [selectedWeekday, setSelectedWeekday] = useState<number | null>(null);

  const dayViewDate =
    isWeekly && selectedWeekday !== null
      ? addDays(weekStart, selectedWeekday)
      : null;
  const view: ViewType =
    isWeekly && selectedWeekday === null ? "week" : "day";

  const loadBlocks = async (routineId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/routines/${routineId}/time-blocks`);

      if (!response.ok) {
        throw new Error("Failed to load time blocks");
      }

      setTimeBlocks((await response.json()) as TimeBlock[]);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open || !routine) {
      setSelectedEventId(null);
      setSelectedWeekday(null);
      document.body.removeAttribute("data-calendar-open");
      return;
    }

    setSelectedEventId(null);
    setSelectedWeekday(null);
    document.body.setAttribute("data-calendar-open", "true");
    void loadBlocks(routine.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, routine?.id]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!routine) {
    return null;
  }

  const createBlock = async (anchor: Date) => {
    const { start, end } = createBlockStub(anchor);

    try {
      const response = await fetch(`/api/routines/${routine.id}/time-blocks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: t("calendar.newBlock"),
          start,
          end,
          isAllDay: false,
          color: "green",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create time block");
      }

      const saved = (await response.json()) as TimeBlock;
      setTimeBlocks((current) => [...current, saved]);
      setSelectedEventId(saved.id);
    } catch (error) {
      console.error(error);
    }
  };

  const handleEventChange = async (event: CalendarEvent) => {
    const previous = timeBlocks;
    setTimeBlocks((current) =>
      current.map((block) =>
        block.id === event.id
          ? {
              ...block,
              title: event.title,
              description: event.description ?? null,
              start: event.start.toISOString(),
              end: event.end.toISOString(),
              isAllDay: event.isAllDay ?? false,
              color: event.color ?? "green",
              confirmation: event.confirmation ?? "none",
            }
          : block,
      ),
    );

    try {
      const response = await fetch(
        `/api/routines/${routine.id}/time-blocks/${event.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: event.title,
            description: event.description ?? null,
            start: event.start,
            end: event.end,
            isAllDay: event.isAllDay ?? false,
            color: event.color ?? "green",
            confirmation: event.confirmation ?? "none",
          }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to update time block");
      }
    } catch (error) {
      console.error(error);
      setTimeBlocks(previous);
    }
  };

  const handleEventDelete = async (event: CalendarEvent) => {
    const previous = timeBlocks;
    setTimeBlocks((current) => current.filter((b) => b.id !== event.id));
    if (selectedEventId === event.id) {
      setSelectedEventId(null);
    }

    try {
      const response = await fetch(
        `/api/routines/${routine.id}/time-blocks/${event.id}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        throw new Error("Failed to delete time block");
      }
    } catch (error) {
      console.error(error);
      setTimeBlocks(previous);
    }
  };

  const handleEventDuplicate = async (event: CalendarEvent) => {
    try {
      const response = await fetch(`/api/routines/${routine.id}/time-blocks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: event.title,
          description: event.description ?? null,
          start: event.start,
          end: event.end,
          isAllDay: event.isAllDay ?? false,
          color: event.color ?? "green",
          confirmation: event.confirmation ?? "none",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to duplicate time block");
      }

      const saved = (await response.json()) as TimeBlock;
      setTimeBlocks((current) => [...current, saved]);
      setSelectedEventId(saved.id);
    } catch (error) {
      console.error(error);
    }
  };

  const handleCellDoubleClick = (day: Date, hour: number) => {
    const anchor = new Date(day);
    anchor.setHours(hour, 0, 0, 0);
    void createBlock(anchor);
  };

  /** Mapeia blocos armazenados para o template genérico. */
  const events: CalendarEvent[] = timeBlocks
    // No modo dia, mostramos apenas os blocos cujo dia da semana armazenado
    // corresponde ao dia selecionado (ex.: segunda-feira vê só as segundas).
    .filter(
      (block) =>
        selectedWeekday === null ||
        new Date(block.start).getDay() === selectedWeekday,
    )
    .map((block) => {
      const event = toCalendarEvent(block);

      if (dayViewDate) {
        // Rotina semanal em modo dia: os blocos do dia selecionado caem no
        // dia exibido, mantendo os horários.
        event.start = applyTimeOfDay(dayViewDate, event.start);
        event.end = applyTimeOfDay(dayViewDate, event.end);
      } else if (isWeekly) {
        // Rotina semanal: blocos caem na mesma coluna do dia da semana.
        const offset = event.start.getDay();
        const target = new Date(weekStart);
        target.setDate(weekStart.getDate() + offset);
        event.start = applyTimeOfDay(target, event.start);
        event.end = applyTimeOfDay(target, event.end);
      } else {
        // Rotina diária: blocos sempre no mesmo horário do dia exibido.
        event.start = applyTimeOfDay(weekStart, event.start);
        event.end = applyTimeOfDay(weekStart, event.end);
      }

      return event;
    });

  const handleCreateAtCurrentTime = () => {
    const now = new Date();
    const anchorDate = dayViewDate ?? weekStart;
    const anchor = new Date(
      anchorDate.getFullYear(),
      anchorDate.getMonth(),
      anchorDate.getDate(),
      now.getHours(),
    );
    void createBlock(anchor);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex h-dvh w-full max-w-none flex-col gap-0 overflow-hidden p-0 sm:h-[85vh] sm:max-h-[85vh] sm:max-w-[1180px]"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-3">
            <h2 className="truncate font-medium">{routine.name}</h2>
            <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-2.5 py-0.5 text-xs capitalize">
              {t(`dialog.${routine.frequency}`)}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              size="sm"
              onClick={handleCreateAtCurrentTime}
              aria-label={t("calendar.newBlock")}
            >
              <Plus />
              <span className="hidden sm:inline">{t("calendar.newBlock")}</span>
            </Button>

            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              aria-label={t("calendar.close")}
            >
              <X />
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 p-3">
          {isWeekly && (
            <div className="scrollbar-hide mb-2 flex items-center gap-1 overflow-x-auto pb-1">
              <Button
                size="sm"
                variant={selectedWeekday === null ? "default" : "outline"}
                onClick={() => setSelectedWeekday(null)}
              >
                {t("calendar.week")}
              </Button>
              {eachDayOfInterval({
                start: weekStart,
                end: addDays(weekStart, 6),
              }).map((day) => {
                const weekday = day.getDay();
                const isActive = selectedWeekday === weekday;
                return (
                  <Button
                    key={weekday}
                    size="sm"
                    variant={isActive ? "default" : "outline"}
                    aria-pressed={isActive}
                    onClick={() => setSelectedWeekday(weekday)}
                  >
                    {format(day, "EEE", { locale: dateLocale })}
                  </Button>
                );
              })}
            </div>
          )}

          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <Spinner className="size-6" />
            </div>
          ) : (
            <WeekView
              view={view}
              currentDate={dayViewDate ?? weekStart}
              events={events}
              locale={dateLocale}
              generic
              onEventClick={(event) => setSelectedEventId(event.id)}
              onEventChange={handleEventChange}
              onEventDelete={handleEventDelete}
              onEventDuplicate={handleEventDuplicate}
              onCellDoubleClick={handleCellDoubleClick}
              selectedEventId={selectedEventId ?? undefined}
              isSidebarOpen={false}
              onClosePopover={() => setSelectedEventId(null)}
              className="h-full overflow-hidden rounded-lg border"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}