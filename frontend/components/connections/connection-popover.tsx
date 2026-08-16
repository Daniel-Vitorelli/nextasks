"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Link2, Minus, Plus } from "lucide-react";

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

/** Opções de uma conexão: contagem necessária, filtro de dia e progresso. */
function ConnectionOptions({
  connection,
  onUpdate,
}: {
  connection: TaskBlockConnection;
  onUpdate: (patch: ConnectionPatch) => void;
}) {
  const t = useTranslations("dashboard.tasks.connections");
  const isDate = connection.dayFilter.startsWith("date:");

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
        value={isDate ? "date:" : connection.dayFilter}
        onChange={(event) => {
          const value = event.target.value;
          onUpdate({
            dayFilter:
              value === "date:" ? `date:${todayLocal()}` : (value as DayFilter),
          });
        }}
        aria-label={t("dayFilter")}
        className="bg-background h-7 w-full rounded-sm border border-border px-1.5 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <option value="all">{t("allDays")}</option>
        {[0, 1, 2, 3, 4, 5, 6].map((day) => (
          <option key={day} value={`weekday:${day}`}>
            {t(`weekday_${day}`)}
          </option>
        ))}
        <option value="date:">{t("specificDate")}</option>
      </select>

      {isDate && (
        <Input
          type="date"
          value={connection.dayFilter.slice("date:".length)}
          onChange={(event) => {
            if (event.target.value) {
              onUpdate({ dayFilter: `date:${event.target.value}` });
            }
          }}
          aria-label={t("specificDate")}
          className="h-7 text-xs"
        />
      )}

      <p className="text-[11px] text-muted-foreground">
        {t("progress", {
          count: connection.confirmedCount,
          required: connection.requiredCount,
        })}
      </p>
    </div>
  );
}

interface ConnectionRowProps {
  title: string;
  subtitle?: string;
  connection: TaskBlockConnection | undefined;
  onToggle: () => void;
  onUpdate: (patch: ConnectionPatch) => void;
}

function ConnectionRow({
  title,
  subtitle,
  connection,
  onToggle,
  onUpdate,
}: ConnectionRowProps) {
  return (
    <div className="rounded-md px-1.5 py-1 hover:bg-muted/50">
      <label className="flex cursor-pointer items-center gap-2 py-0.5">
        <Checkbox
          checked={!!connection}
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
      {connection && (
        <ConnectionOptions connection={connection} onUpdate={onUpdate} />
      )}
    </div>
  );
}

export function ConnectionPopover({
  anchor,
  children,
}: ConnectionPopoverProps) {
  const t = useTranslations("dashboard.tasks.connections");
  const { data, isLoading, reload, toggleConnection, updateConnection } =
    useConnections();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (open) void reload();
  }, [open, reload]);

  const isEntity = anchor.type === "task" || anchor.type === "subtask";

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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-80 p-0">
        <div className="border-border flex items-center gap-1.5 border-b px-3 py-2">
          <Link2 className="text-muted-foreground size-3.5" />
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-[0.2em]">
            {isEntity ? t("blocksSection") : t("entitiesSection")}
          </p>
        </div>

        <div className="max-h-72 overflow-y-auto p-1.5">
          {isLoading && !data ? (
            <p className="text-muted-foreground px-2 py-3 text-xs">
              {t("loading")}
            </p>
          ) : isEntity ? (
            (data?.blocks.length ?? 0) === 0 ? (
              <p className="text-muted-foreground px-2 py-3 text-xs">
                {t("noBlocks")}
              </p>
            ) : (
              data?.blocks.map((block: ConnectionCatalogBlock) => {
                const connection = findConnection(block.id);
                return (
                  <ConnectionRow
                    key={block.id}
                    title={block.title}
                    subtitle={block.routineName}
                    connection={connection}
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
          ) : (data?.tasks.length ?? 0) === 0 &&
            (data?.subtasks.length ?? 0) === 0 ? (
            <p className="text-muted-foreground px-2 py-3 text-xs">
              {t("noTasks")}
            </p>
          ) : (
            <>
              {data?.tasks.map((task) => {
                const connection = data.connections.find(
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
              {data?.subtasks.map((subtask) => {
                const connection = data.connections.find(
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
          {t("hint")}
        </div>
      </PopoverContent>
    </Popover>
  );
}