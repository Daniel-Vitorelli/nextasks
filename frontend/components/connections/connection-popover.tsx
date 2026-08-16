"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Link2, Minus, Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useConnections } from "./connections-provider";
import type {
  ConnectionCatalogBlock,
  ConnectionPatch,
  DayFilter,
  Frequency,
  TaskBlockConnection,
} from "@/types/domain";

export type ConnectionAnchor =
  | { type: "task"; id: string; title: string }
  | { type: "subtask"; id: string; title: string }
  | { type: "block"; id: string; title: string };

interface ConnectionPopoverProps {
  anchor: ConnectionAnchor;
  children: React.ReactNode;
}

function todayLocal(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function formatLocalDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Próxima data local cujo dia da semana seja `weekday` (hoje incluso). */
function nextDateForWeekday(weekday: number): string {
  const date = new Date();
  while (date.getDay() !== weekday) {
    date.setDate(date.getDate() + 1);
  }
  return formatLocalDate(date);
}

/** Dia da semana (0-6) de uma data local "YYYY-MM-DD". */
function dateWeekday(dateString: string): number {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day).getDay();
}

/**
 * O dayFilter é possível de satisfazer para este bloco? Blocos semanais só
 * ocorrem no próprio dia da semana: weekday de outro dia ou data em outro
 * dia da semana nunca casam. Blocos diários aceitam qualquer filtro.
 */
function isDayFilterSatisfiable(
  dayFilter: DayFilter,
  frequency: Frequency,
  blockWeekday: number,
): boolean {
  if (dayFilter === "all" || frequency === "daily") return true;
  if (dayFilter.startsWith("weekday:")) {
    return Number(dayFilter.slice("weekday:".length)) === blockWeekday;
  }
  return dateWeekday(dayFilter.slice("date:".length)) === blockWeekday;
}

/** Opções de uma conexão: contagem necessária, filtro de dia e progresso. */
function ConnectionOptions({
  connection,
  frequency,
  blockWeekday,
  onUpdate,
}: {
  connection: TaskBlockConnection;
  frequency: Frequency;
  blockWeekday: number;
  onUpdate: (patch: ConnectionPatch) => void;
}) {
  const t = useTranslations("dashboard.tasks.connections");
  const isDate = connection.dayFilter.startsWith("date:");
  const [dateError, setDateError] = React.useState(false);

  const currentValid = isDayFilterSatisfiable(
    connection.dayFilter,
    frequency,
    blockWeekday,
  );
  const weekdays =
    frequency === "weekly" ? [blockWeekday] : [0, 1, 2, 3, 4, 5, 6];
  const satisfied = connection.confirmedCount >= connection.requiredCount;

  return (
    <div className="mt-1 flex flex-col gap-1.5 pl-6">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">
          {t("requiredCount")}
        </span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon-xs"
            variant="outline"
            onClick={() =>
              onUpdate({
                requiredCount: Math.max(1, connection.requiredCount - 1),
              })
            }
            aria-label={t("decrease")}
          >
            <Minus />
          </Button>
          <span className="w-6 text-center text-xs font-medium">
            {connection.requiredCount}
          </span>
          <Button
            type="button"
            size="icon-xs"
            variant="outline"
            onClick={() =>
              onUpdate({
                requiredCount: Math.min(99, connection.requiredCount + 1),
              })
            }
            aria-label={t("increase")}
          >
            <Plus />
          </Button>
        </div>
      </div>

      <select
        value={currentValid ? (isDate ? "date:" : connection.dayFilter) : "all"}
        onChange={(event) => {
          const value = event.target.value;
          setDateError(false);
          if (value === "date:") {
            const date =
              frequency === "weekly"
                ? nextDateForWeekday(blockWeekday)
                : todayLocal();
            onUpdate({ dayFilter: `date:${date}` });
          } else {
            onUpdate({ dayFilter: value as DayFilter });
          }
        }}
        aria-label={t("dayFilter")}
        className="bg-background h-7 w-full rounded-sm border border-border px-1.5 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <option value="all">{t("allDays")}</option>
        {weekdays.map((day) => (
          <option key={day} value={`weekday:${day}`}>
            {t(`weekday_${day}`)}
          </option>
        ))}
        <option value="date:">{t("specificDate")}</option>
      </select>

      {isDate && (
        <>
          <Input
            type="date"
            value={connection.dayFilter.slice("date:".length)}
            onChange={(event) => {
              const value = event.target.value;
              if (!value) return;
              if (
                frequency === "weekly" &&
                dateWeekday(value) !== blockWeekday
              ) {
                setDateError(true);
                return;
              }
              setDateError(false);
              onUpdate({ dayFilter: `date:${value}` });
            }}
            aria-label={t("specificDate")}
            className="h-7 text-xs"
          />
          {frequency === "weekly" && (
            <p
              className={
                dateError
                  ? "text-[11px] text-destructive"
                  : "text-muted-foreground text-[11px]"
              }
            >
              {dateError
                ? t("dateInvalidWeekly", { day: t(`weekday_${blockWeekday}`) })
                : t("dateHintWeekly", { day: t(`weekday_${blockWeekday}`) })}
            </p>
          )}
        </>
      )}

      {!currentValid && (
        <div className="bg-muted/50 flex flex-col gap-1 rounded-sm px-2 py-1.5">
          <p className="text-[11px] leading-snug text-muted-foreground">
            {t("filterImpossible", { day: t(`weekday_${blockWeekday}`) })}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-6 self-start text-[11px]"
            onClick={() =>
              onUpdate({ dayFilter: `weekday:${blockWeekday}` })
            }
          >
            {t("fixFilter", { day: t(`weekday_${blockWeekday}`) })}
          </Button>
        </div>
      )}

      <p
        className={
          satisfied
            ? "text-emerald-600 text-[11px] dark:text-emerald-400"
            : "text-muted-foreground text-[11px]"
        }
      >
        {t(frequency === "weekly" ? "progressWeekly" : "progressDaily", {
          count: connection.confirmedCount,
          required: connection.requiredCount,
        })}
        {" · "}
        {satisfied ? t("satisfied") : t("pending")}
      </p>
    </div>
  );
}

interface ConnectionRowProps {
  title: string;
  subtitle?: string;
  connection: TaskBlockConnection | undefined;
  disabled?: boolean;
  frequency: Frequency;
  blockWeekday: number;
  onToggle: () => void;
  onUpdate: (patch: ConnectionPatch) => void;
}

function ConnectionRow({
  title,
  subtitle,
  connection,
  disabled = false,
  frequency,
  blockWeekday,
  onToggle,
  onUpdate,
}: ConnectionRowProps) {
  return (
    <div
      className={
        disabled
          ? "rounded-md px-1.5 py-1 opacity-60"
          : "rounded-md px-1.5 py-1 hover:bg-muted/50"
      }
    >
      <label className="flex cursor-pointer items-center gap-2 py-0.5">
        <Checkbox
          checked={!!connection}
          disabled={disabled}
          onCheckedChange={onToggle}
          className="shrink-0"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{title}</span>
          {subtitle && (
            <span className="text-muted-foreground block truncate text-xs">
              {subtitle}
            </span>
          )}
        </span>
      </label>
      {connection && !disabled && (
        <ConnectionOptions
          connection={connection}
          frequency={frequency}
          blockWeekday={blockWeekday}
          onUpdate={onUpdate}
        />
      )}
    </div>
  );
}

/** Rótulo da recorrência de um bloco ("Todos os dias" / "Toda quarta-feira"). */
function blockRecurrence(
  frequency: Frequency,
  weekday: number,
  t: ReturnType<typeof useTranslations>,
): string {
  return frequency === "weekly"
    ? t("recurrenceWeekly", { day: t(`weekday_${weekday}`) })
    : t("recurrenceDaily");
}

export function ConnectionPopover({
  anchor,
  children,
}: ConnectionPopoverProps) {
  const t = useTranslations("dashboard.tasks.connections");
  const { data, isLoading, reload, toggleConnection, updateConnection } =
    useConnections();
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      setOpen(next);
      if (next) {
        setSearch("");
        void reload();
      }
    },
    [reload],
  );

  const isEntity = anchor.type === "task" || anchor.type === "subtask";
  const anchorBlock =
    !isEntity && data
      ? data.blocks.find((block) => block.id === anchor.id)
      : undefined;

  const query = search.trim().toLowerCase();
  const matches = (title: string) =>
    query === "" || title.toLowerCase().includes(query);
  const filteredBlocks = data?.blocks.filter((block) =>
    matches(block.title),
  );
  const filteredTasks = data?.tasks.filter((task) => matches(task.title));
  const filteredSubtasks = data?.subtasks.filter((subtask) =>
    matches(subtask.title),
  );

  const findConnection = React.useCallback(
    (timeBlockId: string): TaskBlockConnection | undefined => {
      if (!data) return undefined;
      return data.connections.find(
        (connection) =>
          connection.timeBlockId === timeBlockId &&
          (anchor.type === "task"
            ? connection.taskId === anchor.id
            : anchor.type === "subtask"
              ? connection.subtaskId === anchor.id
              : false),
      );
    },
    [data, anchor],
  );

  const updateFor = React.useCallback(
    (connection: TaskBlockConnection | undefined, patch: ConnectionPatch) => {
      if (connection) void updateConnection(connection.id, patch);
    },
    [updateConnection],
  );

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-80 p-0">
        <div className="border-border flex items-center gap-1.5 border-b px-3 py-2">
          <Link2 className="text-muted-foreground size-3.5" />
          <div className="min-w-0 flex-1">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-[0.2em]">
              {isEntity ? t("blocksSection") : t("entitiesSection")}
            </p>
            {anchorBlock && (
              <p className="truncate text-[11px] text-muted-foreground/80">
                {t("occurs", {
                  recurrence: blockRecurrence(
                    anchorBlock.frequency,
                    anchorBlock.weekday,
                    t,
                  ),
                })}
              </p>
            )}
          </div>
        </div>

        <div className="border-border p-1.5 pb-0">
          <div className="bg-muted/50 flex items-center gap-1.5 rounded-sm px-2">
            <Search className="text-muted-foreground size-3.5 shrink-0" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("search")}
              aria-label={t("search")}
              className="bg-transparent h-7 border-none px-0 text-xs shadow-none focus-visible:ring-0"
            />
          </div>
        </div>

        <div className="max-h-64 overflow-y-auto p-1.5">
          {isLoading && !data ? (
            <p className="text-muted-foreground px-2 py-3 text-xs">
              {t("loading")}
            </p>
          ) : isEntity ? (
            (filteredBlocks?.length ?? 0) === 0 ? (
              <p className="text-muted-foreground px-2 py-3 text-xs">
                {(data?.blocks.length ?? 0) === 0
                  ? t("noBlocks")
                  : t("noMatches")}
              </p>
            ) : (
              filteredBlocks?.map((block: ConnectionCatalogBlock) => {
                const connection = findConnection(block.id);
                const disabled = block.confirmation === "none";
                return (
                  <ConnectionRow
                    key={block.id}
                    title={block.title}
                    subtitle={
                      disabled
                        ? t("noConfirmation")
                        : `${block.routineName} · ${blockRecurrence(
                            block.frequency,
                            block.weekday,
                            t,
                          )}`
                    }
                    connection={connection}
                    disabled={disabled}
                    frequency={block.frequency}
                    blockWeekday={block.weekday}
                    onToggle={() =>
                      void toggleConnection({
                        taskId:
                          anchor.type === "task" ? anchor.id : null,
                        subtaskId:
                          anchor.type === "subtask" ? anchor.id : null,
                        timeBlockId: block.id,
                      })
                    }
                    onUpdate={(patch) => updateFor(connection, patch)}
                  />
                );
              })
            )
          ) : (filteredTasks?.length ?? 0) === 0 &&
            (filteredSubtasks?.length ?? 0) === 0 ? (
            <p className="text-muted-foreground px-2 py-3 text-xs">
              {(data?.tasks.length ?? 0) === 0 &&
              (data?.subtasks.length ?? 0) === 0
                ? t("noTasks")
                : t("noMatches")}
            </p>
          ) : (
            <>
              {filteredTasks?.map((task) => {
                const connection = data?.connections.find(
                  (item) =>
                    item.taskId === task.id &&
                    item.timeBlockId === anchor.id,
                );
                return (
                  <ConnectionRow
                    key={task.id}
                    title={task.title}
                    subtitle={t("taskBadge")}
                    connection={connection}
                    frequency={anchorBlock?.frequency ?? "daily"}
                    blockWeekday={anchorBlock?.weekday ?? 0}
                    onToggle={() =>
                      void toggleConnection({
                        taskId: task.id,
                        timeBlockId: anchor.id,
                      })
                    }
                    onUpdate={(patch) => updateFor(connection, patch)}
                  />
                );
              })}
              {filteredSubtasks?.map((subtask) => {
                const connection = data?.connections.find(
                  (item) =>
                    item.subtaskId === subtask.id &&
                    item.timeBlockId === anchor.id,
                );
                return (
                  <ConnectionRow
                    key={subtask.id}
                    title={subtask.title}
                    subtitle={subtask.taskTitle}
                    connection={connection}
                    frequency={anchorBlock?.frequency ?? "daily"}
                    blockWeekday={anchorBlock?.weekday ?? 0}
                    onToggle={() =>
                      void toggleConnection({
                        subtaskId: subtask.id,
                        timeBlockId: anchor.id,
                      })
                    }
                    onUpdate={(patch) => updateFor(connection, patch)}
                  />
                );
              })}
            </>
          )}
        </div>

        <div className="border-border border-t px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
          {t(isEntity ? "hintEntity" : "hintBlock")}
        </div>
      </PopoverContent>
    </Popover>
  );
}