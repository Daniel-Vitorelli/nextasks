"use client";

import { useTranslations } from "next-intl";
import type { DailyProgress, EventColor } from "@/types/domain";

const DAY_MS = 86_400_000;
const TOTAL_DAYS = 365;

interface HeatmapProps {
  data: DailyProgress[];
  locale: string;
  tzOffsetMinutes: number;
  /** Cor de destaque dos níveis (padrão: escala esmeralda da rotina). */
  color?: EventColor;
}

interface Cell {
  date: Date;
  value: number | null;
}

/** Início do dia local (hoje), como instante UTC. */
function startOfLocalDay(tzOffsetMinutes: number): Date {
  const localMs = Date.now() - tzOffsetMinutes * 60_000;
  return new Date(localMs - (localMs % DAY_MS) + tzOffsetMinutes * 60_000);
}

/** Chave "YYYY-MM-DD" do dia local do instante. */
function localDateKey(utc: Date, tzOffsetMinutes: number): string {
  const local = new Date(utc.getTime() - tzOffsetMinutes * 60_000);
  const month = String(local.getUTCMonth() + 1).padStart(2, "0");
  const day = String(local.getUTCDate()).padStart(2, "0");
  return `${local.getUTCFullYear()}-${month}-${day}`;
}

/** Dia da semana local (0 = domingo). */
function localWeekday(utc: Date, tzOffsetMinutes: number): number {
  return new Date(utc.getTime() - tzOffsetMinutes * 60_000).getUTCDay();
}

function levelClass(value: number | null): string {
  if (value === null) return "bg-transparent";
  if (value === 0) return "bg-muted";
  if (value < 25) return "bg-emerald-500/30";
  if (value < 50) return "bg-emerald-500/50";
  if (value < 75) return "bg-emerald-500/70";
  if (value < 100) return "bg-emerald-500/90";
  return "bg-emerald-500";
}

/** Intensidade (%) da cor do hábito para o nível do valor informado. */
function levelOpacity(value: number): number {
  if (value < 25) return 30;
  if (value < 50) return 50;
  if (value < 75) return 70;
  if (value < 100) return 90;
  return 100;
}

export function Heatmap({ data, locale, tzOffsetMinutes, color }: HeatmapProps) {
  const t = useTranslations("app.home.streak");

  const today = startOfLocalDay(tzOffsetMinutes);
  const valueByKey = new Map(
    data.map((item) => [
      localDateKey(new Date(item.date), tzOffsetMinutes),
      item.value,
    ]),
  );

  const cellBackground = (value: number | null) => {
    if (color === undefined) {
      return { className: levelClass(value), style: undefined };
    }
    if (value === null || value === 0) {
      return {
        className: value === null ? "bg-transparent" : "bg-muted",
        style: undefined,
      };
    }
    return {
      className: "",
      style: {
        backgroundColor: `color-mix(in oklab, var(--event-${color}) ${levelOpacity(value)}%, transparent)`,
      },
    };
  };

  // Últimos 365 dias, do mais antigo ao mais recente.
  const cells: Cell[] = [];
  for (let daysAgo = TOTAL_DAYS - 1; daysAgo >= 0; daysAgo -= 1) {
    const date = new Date(today.getTime() - daysAgo * DAY_MS);
    cells.push({
      date,
      value: valueByKey.get(localDateKey(date, tzOffsetMinutes)) ?? null,
    });
  }

  // Alinha as semanas a domingos: colunas = semanas, linhas = dias da semana.
  const leading = localWeekday(cells[0].date, tzOffsetMinutes);
  const padded: (Cell | null)[] = [
    ...Array<null>(leading).fill(null),
    ...cells,
  ];
  const columns: (Cell | null)[][] = [];
  for (let i = 0; i < padded.length; i += 7) {
    columns.push(padded.slice(i, i + 7));
  }

  const dateFormatter = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  const monthFormatter = new Intl.DateTimeFormat(locale, {
    month: "short",
    timeZone: "UTC",
  });

  // Rótulos dos meses: a coluna que contém o dia 1º de cada mês (o topo da
  // coluna pode ser o último domingo do mês anterior, então o rótulo é o mês
  // do dia 1º, não o do topo).
  const monthLabels = columns.map((column) => {
    const firstOfMonth = column.find(
      (cell) => cell !== null && cell.date.getUTCDate() === 1,
    );
    return firstOfMonth ? monthFormatter.format(firstOfMonth.date) : "";
  });

  // Letras dos dias da semana (domingo em cima).
  const weekdayLetters = Array.from({ length: 7 }, (_, row) => {
    const date = new Date(today.getTime() + (row - localWeekday(today, tzOffsetMinutes)) * DAY_MS);
    return new Intl.DateTimeFormat(locale, {
      weekday: "short",
      timeZone: "UTC",
    })
      .format(date)
      .charAt(0);
  });

  const legendLevels = [
  "bg-muted",
  "bg-emerald-500/30",
  "bg-emerald-500/50",
  "bg-emerald-500/70",
  "bg-emerald-500/90",
  "bg-emerald-500",
];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex w-max gap-[3px] pl-4">
        {monthLabels.map((label, index) => (
          <div
            key={index}
            className="w-3 shrink-0 overflow-visible text-[10px] leading-4 whitespace-nowrap text-muted-foreground"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="flex w-max gap-[3px]">
        <div className="flex shrink-0 flex-col gap-[3px] pr-1">
          {weekdayLetters.map((letter, index) => (
            <div
              key={index}
              className="flex h-3 w-3 items-center justify-center text-[8px] text-muted-foreground"
            >
              {letter}
            </div>
          ))}
        </div>

        {columns.map((column, index) => (
          <div key={index} className="flex shrink-0 flex-col gap-[3px]">
            {column.map((cell, row) =>
              cell ? (
                <div
                  key={row}
                  title={`${dateFormatter.format(cell.date)} — ${
                    cell.value === null ? t("noData") : t("percent", { value: cell.value })
                  }`}
                  {...(() => {
                    const { className, style } = cellBackground(cell.value);
                    return {
                      className: `size-3 rounded-[3px] ${className}`,
                      style,
                    };
                  })()}
                />
              ) : (
                <div key={row} className="size-3" />
              ),
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end gap-1.5 pl-4">
        <span className="text-[10px] text-muted-foreground">{t("less")}</span>
        {color === undefined
          ? legendLevels.map((className) => (
              <div key={className} className={`size-3 rounded-[3px] ${className}`} />
            ))
          : [30, 50, 70, 90, 100].map((opacity) => (
              <div
                key={opacity}
                className="size-3 rounded-[3px]"
                style={{
                  backgroundColor: `color-mix(in oklab, var(--event-${color}) ${opacity}%, transparent)`,
                }}
              />
            ))}
        <span className="text-[10px] text-muted-foreground">{t("more")}</span>
      </div>
    </div>
  );
}