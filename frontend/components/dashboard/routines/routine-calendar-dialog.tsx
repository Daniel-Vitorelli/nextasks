"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { addDays, eachDayOfInterval, endOfDay, format, startOfWeek } from "date-fns";
import { enUS, ptBR } from "date-fns/locale";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { WeekView } from "@/components/calendar/week-view";
import type { CalendarEvent, ViewType } from "@/types/calendar";
import type { Routine } from "@/types/domain";
import { applyTimeOfDay, createBlockStub, toCalendarEvent } from "@/lib/time-blocks";
import { useRoutineTimeBlocks } from "./use-routine-time-blocks";

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

  const {
    timeBlocks,
    isLoading,
    selectedEventId,
    loadBlocks,
    createBlock,
    updateBlock,
    deleteBlock,
    duplicateBlock,
    setSelectedEventId,
  } = useRoutineTimeBlocks(routine?.id ?? null);

  const [selectedWeekday, setSelectedWeekday] = useState<number | null>(null);

  const dayViewDate =
    isWeekly && selectedWeekday !== null
      ? addDays(weekStart, selectedWeekday)
      : null;
  const view: ViewType = isWeekly && selectedWeekday === null ? "week" : "day";

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

  const handleCreateAtCurrentTime = () => {
    const now = new Date();
    const anchorDate = dayViewDate ?? weekStart;
    const anchor = new Date(
      anchorDate.getFullYear(),
      anchorDate.getMonth(),
      anchorDate.getDate(),
      now.getHours(),
    );
    void createBlock({
      title: t("calendar.newBlock"),
      ...createBlockStub(anchor),
      isAllDay: false,
      color: "green",
    });
  };

  const handleCellDoubleClick = (day: Date, hour: number) => {
    const anchor = new Date(day);
    anchor.setHours(hour, 0, 0, 0);
    void createBlock({
      title: t("calendar.newBlock"),
      ...createBlockStub(anchor),
      isAllDay: false,
      color: "green",
    });
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

      let baseStart: Date;
      if (dayViewDate) {
        // Rotina semanal em modo dia: os blocos do dia selecionado caem no
        // dia exibido, mantendo os horários.
        baseStart = dayViewDate;
      } else if (isWeekly) {
        // Rotina semanal: blocos caem na mesma coluna do dia da semana.
        const offset = event.start.getDay();
        baseStart = new Date(weekStart);
        baseStart.setDate(weekStart.getDate() + offset);
      } else {
        // Rotina diária: blocos sempre no mesmo horário do dia exibido.
        baseStart = weekStart;
      }

      event.start = applyTimeOfDay(baseStart, event.start);
      event.end = applyTimeOfDay(baseStart, event.end);

      // Blocos nunca cruzam a meia-noite: se o fim caiu antes do inicio
      // (bloco antigo armazenado com fim no dia seguinte), o fim vai ao
      // ultimo horario disponivel do dia (23:59:59.999).
      if (event.end.getTime() <= event.start.getTime()) {
        event.end = endOfDay(baseStart);
      }

      return event;
    });

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
              onEventChange={updateBlock}
              onEventDelete={deleteBlock}
              onEventDuplicate={duplicateBlock}
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
