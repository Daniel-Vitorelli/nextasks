"use client";

import * as React from "react";
import {
  addDays,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  type Locale,
} from "date-fns";

import { cn } from "@/lib/utils";
import {
  blockBorderClass,
  blockTextClass,
} from "@/components/connections/connection-colors";
import type { CalendarEvent } from "@/types/calendar";

interface MonthViewProps {
  /** Qualquer data dentro do mês exibido. */
  currentDate: Date;
  events?: CalendarEvent[];
  locale?: Locale;
  className?: string;
  onEventClick?: (event: CalendarEvent) => void;
}

/** Máximo de chips por célula antes do indicador "+N". */
const MAX_CHIPS = 2;

/**
 * Visão mensal clássica: grade fixa de 6 semanas (domingo como primeiro dia,
 * mesma convenção da página), chips por evento e destaque do dia atual.
 */
export function MonthView({
  currentDate,
  events = [],
  locale,
  className,
  onEventClick,
}: MonthViewProps) {
  const monthStart = React.useMemo(
    () => startOfMonth(currentDate),
    [currentDate],
  );

  // Grade de 42 dias começando no domingo anterior ao dia 1º.
  const gridStart = React.useMemo(
    () => addDays(monthStart, -monthStart.getDay()),
    [monthStart],
  );
  const cells = React.useMemo(
    () => Array.from({ length: 42 }, (_, index) => addDays(gridStart, index)),
    [gridStart],
  );

  const eventsByDay = React.useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const start = new Date(event.start);
      const key = `${start.getFullYear()}-${start.getMonth()}-${start.getDate()}`;
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    }
    return map;
  }, [events]);

  const today = new Date();

  const weekdays = React.useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) =>
        format(addDays(gridStart, index), "EEE", { locale }),
      ),
    [gridStart, locale],
  );

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* Cabeçalho dos dias da semana */}
      <div
        className="border-border/60 grid grid-cols-7 border-b"
        aria-hidden
      >
        {weekdays.map((day) => (
          <div
            key={day}
            className="text-muted-foreground px-1 py-1 text-center text-[10px] font-medium uppercase tracking-wider"
          >
            {day.charAt(0).toUpperCase() + day.slice(1)}
          </div>
        ))}
      </div>

      {/* Grade de dias */}
      <div
        className="border-border/60 bg-border/30 grid flex-1 grid-cols-7 grid-rows-6 gap-px overflow-hidden"
        role="grid"
      >
        {cells.map((cell) => {
          const inMonth = isSameMonth(cell, monthStart);
          const isToday = isSameDay(cell, today);
          const key = `${cell.getFullYear()}-${cell.getMonth()}-${cell.getDate()}`;
          const dayEvents = eventsByDay.get(key) ?? [];
          const visibleEvents = dayEvents.slice(0, MAX_CHIPS);
          const hiddenCount = dayEvents.length - visibleEvents.length;

          return (
            <div
              key={key}
              role="gridcell"
              aria-label={format(cell, "PPPP", { locale })}
              className={cn(
                "group bg-card flex min-h-[88px] flex-col p-1",
                !inMonth && "bg-muted/20",
              )}
            >
              <span
                className={cn(
                  "mb-0.5 flex size-[22px] items-center justify-center self-start rounded-full text-[11px] tabular-nums",
                  isToday
                    ? "bg-primary font-bold text-primary-foreground"
                    : inMonth
                      ? "text-foreground/80 group-hover:bg-muted"
                      : "text-muted-foreground/40",
                )}
              >
                {cell.getDate()}
              </span>

              <div className="flex min-w-0 flex-col">
                {visibleEvents.map((event) => {
                  const color = event.color ?? "green";
                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => onEventClick?.(event)}
                      title={event.title}
                      className="hover:bg-muted flex w-full items-center gap-1 rounded px-0.5 py-[1px] text-left"
                    >
                      <span
                        className={cn(
                          "size-1.5 shrink-0 rounded-full",
                          blockBorderClass(color),
                        )}
                      />
                      <span
                        className={cn(
                          "truncate text-[11px] leading-tight",
                          blockTextClass(color),
                        )}
                      >
                        {event.title}
                      </span>
                    </button>
                  );
                })}
                {hiddenCount > 0 && (
                  <span className="text-muted-foreground px-0.5 text-[10px] tabular-nums">
                    +{hiddenCount}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Utilitário exposto para a página montar o intervalo da grade mensal. */
export function monthGridRange(anchor: Date): { start: Date; end: Date } {
  const monthStart = startOfMonth(anchor);
  const gridStart = addDays(monthStart, -monthStart.getDay());
  return { start: gridStart, end: addDays(gridStart, 41) };
}
