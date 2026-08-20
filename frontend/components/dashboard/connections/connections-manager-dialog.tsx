"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  Link2,
  ListChecks,
  Minus,
  Plus,
  Repeat2,
  Search,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useConnections } from "@/components/connections/connections-provider";
import {
  blockRecurrence,
  dateWeekday,
  dayFilterDate,
  dayFilterLabel,
  dayFilterOptions,
  formatClockTime,
  isDateFilter,
  isDayFilterSatisfiable,
  nextDateForWeekday,
  todayLocal,
} from "@/components/connections/connection-utils";
import {
  blockBorderClass,
  blockTintClass,
  blockTextClass,
  solidTextOnColor,
} from "@/components/connections/connection-colors";
import type {
  ConnectionCatalogBlock,
  ConnectionCatalogSubtask,
  ConnectionCatalogTask,
  ConnectionPatch,
  DayFilter,
  EventColor,
  Frequency,
  TaskBlockConnection,
} from "@/types/domain";

interface ConnectionsManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConnectionsManagerDialog({
  open,
  onOpenChange,
}: ConnectionsManagerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl gap-0 overflow-hidden p-0">
        <DialogBody key={open ? "open" : "closed"} />
      </DialogContent>
    </Dialog>
  );
}

function DialogBody() {
  const t = useTranslations("dashboard.connections");
  const tc = useTranslations("dashboard.tasks.connections");
  const { data, isLoading } = useConnections();
  const [tab, setTab] = React.useState<"blocks" | "entities">("blocks");
  const [search, setSearch] = React.useState("");

  const query = search.trim().toLowerCase();
  const matches = (title: string) =>
    query === "" || title.toLowerCase().includes(query);

  return (
    <div className="flex max-h-[calc(100dvh-4rem)] flex-col">
      <div className="border-border flex flex-col gap-4 border-b px-6 pt-6 pb-4">
        <DialogHeader className="text-left">
          <DialogTitle>{t("dialog.title")}</DialogTitle>
          <DialogDescription>{t("dialog.description")}</DialogDescription>
        </DialogHeader>
        <HowItWorks />
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-6">
        {isLoading && !data ? (
          <div className="flex items-center justify-center py-12">
            <Spinner className="size-6" />
          </div>
        ) : (
          <>
            <StatsRow />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="bg-muted/60 flex items-center gap-1 rounded-lg p-1">
                <TabButton
                  active={tab === "blocks"}
                  onClick={() => setTab("blocks")}
                >
                  {t("tabBlocks")}
                </TabButton>
                <TabButton
                  active={tab === "entities"}
                  onClick={() => setTab("entities")}
                >
                  {t("tabEntities")}
                </TabButton>
              </div>

              <div className="bg-muted/50 flex min-w-0 flex-1 items-center gap-1.5 rounded-sm px-2 sm:max-w-64">
                <Search className="text-muted-foreground size-3.5 shrink-0" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={tc("search")}
                  aria-label={tc("search")}
                  className="bg-transparent h-7 border-none px-0 text-xs shadow-none focus-visible:ring-0"
                />
              </div>
            </div>

            {tab === "blocks" ? (
              <BlocksTab matches={matches} />
            ) : (
              <EntitiesTab matches={matches} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function HowItWorks() {
  const t = useTranslations("dashboard.connections");
  const steps = [
    {
      icon: Link2,
      title: t("how.connectTitle"),
      text: t("how.connectDescription"),
      tone: "text-primary",
    },
    {
      icon: Repeat2,
      title: t("how.fulfillTitle"),
      text: t("how.fulfillDescription"),
      tone: "text-amber-600 dark:text-amber-400",
    },
    {
      icon: Sparkles,
      title: t("how.automateTitle"),
      text: t("how.automateDescription"),
      tone: "text-emerald-600 dark:text-emerald-400",
    },
  ];

  return (
    <div className="space-y-3">
      <div className="border-border/60 bg-muted/30 flex flex-wrap items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-2.5">
        <FlowBox
          icon={<ListChecks className="size-3.5" />}
          label={t("how.flowTask")}
          tone="bg-event-blue-bg text-event-blue"
        />
        <ArrowRight className="text-muted-foreground size-4 shrink-0" />
        <FlowBox
          icon={<Clock className="size-3.5" />}
          label={t("how.flowBlock")}
          tone="bg-event-purple-bg text-event-purple"
        />
        <ArrowRight className="text-muted-foreground size-4 shrink-0" />
        <FlowBox
          icon={<CheckCircle2 className="size-3.5" />}
          label={t("how.flowDone")}
          tone="bg-event-green-bg text-event-green"
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {steps.map((step) => (
          <div
            key={step.title}
            className="bg-muted/50 flex items-start gap-2.5 rounded-lg p-3"
          >
            <span
              className={cn(
                "bg-background flex size-6 shrink-0 items-center justify-center rounded-full shadow-sm",
              )}
            >
              <step.icon className={cn("size-3.5", step.tone)} />
            </span>
            <div className="space-y-0.5">
              <p className="text-xs font-semibold">{step.title}</p>
              <p className="text-muted-foreground text-[11px] leading-snug">
                {step.text}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FlowBox({
  icon,
  label,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  tone: string;
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium",
        tone,
      )}
    >
      {icon}
      {label}
    </span>
  );
}

function StatsRow() {
  const t = useTranslations("dashboard.connections");
  const { data } = useConnections();

  const total = data?.connections.length ?? 0;
  const satisfied =
    data?.connections.filter(
      (connection) => connection.confirmedCount >= connection.requiredCount,
    ).length ?? 0;
  const entities = new Set(
    data?.connections.flatMap((connection) =>
      connection.taskId ?? connection.subtaskId ?? [],
    ),
  ).size;

  const stats = [
    { icon: Link2, label: t("stats.total"), value: total, tone: "text-muted-foreground" },
    {
      icon: CheckCircle2,
      label: t("stats.satisfied"),
      value: satisfied,
      tone: "text-emerald-600 dark:text-emerald-400",
    },
    {
      icon: Clock,
      label: t("stats.pending"),
      value: total - satisfied,
      tone: "text-amber-600 dark:text-amber-400",
    },
    {
      icon: ListChecks,
      label: t("stats.entities"),
      value: entities,
      tone: "text-blue-600 dark:text-blue-400",
    },
  ];

  return (
    <div className="flex flex-wrap gap-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="border-border/60 bg-background flex items-center gap-2.5 rounded-lg border px-3 py-2"
        >
          <stat.icon className={cn("size-4 shrink-0", stat.tone)} />
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-semibold tabular-nums">
              {stat.value}
            </span>
            <span className="text-muted-foreground text-[11px]">
              {stat.label}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground px-2 py-4 text-center text-xs">
      {children}
    </p>
  );
}

/** Mini linha do tempo da semana: destaca os dias em que o bloco ocorre. */
function WeekStrip({
  frequency,
  weekday,
  color,
}: {
  frequency: Frequency;
  weekday: number;
  color: EventColor;
}) {
  const t = useTranslations("dashboard.tasks.connections");
  const solid = blockBorderClass(color);
  const text = solidTextOnColor[color];

  return (
    <div
      className="flex items-center gap-1"
      aria-label={t(frequency === "weekly" ? "recurrenceWeekly" : "recurrenceDaily")}
    >
      {[0, 1, 2, 3, 4, 5, 6].map((day) => {
        const isBlockDay = day === weekday;
        const daily = frequency === "daily";
        return (
          <span
            key={day}
            title={t(`weekday_${day}`)}
            className={cn(
              "flex size-5 items-center justify-center rounded-full text-[9px] font-semibold",
              daily
                ? cn(blockTintClass(color), blockTextClass(color))
                : isBlockDay
                  ? cn(solid, text)
                  : "bg-muted text-muted-foreground",
            )}
          >
            {t(`weekdayShort_${day}`)}
          </span>
        );
      })}
    </div>
  );
}

function BlocksTab({
  matches,
}: {
  matches: (title: string) => boolean;
}) {
  const t = useTranslations("dashboard.tasks.connections");
  const { data } = useConnections();

  if (!data) return null;
  if (data.blocks.length === 0) return <EmptyHint>{t("noBlocks")}</EmptyHint>;

  const blocks = data.blocks.filter((block) => matches(block.title));
  if (blocks.length === 0) return <EmptyHint>{t("noMatches")}</EmptyHint>;

  return (
    <div className="space-y-3">
      {blocks.map((block) => {
        const tasks = data.tasks.filter((task) => matches(task.title));
        const subtasks = data.subtasks.filter((subtask) =>
          matches(subtask.title),
        );
        const disabled =
          block.confirmation === "none" || !block.routineActive;
        return (
          <BlockCard
            key={block.id}
            block={block}
            tasks={tasks}
            subtasks={subtasks}
            disabled={disabled}
          />
        );
      })}
    </div>
  );
}

function BlockCard({
  block,
  tasks,
  subtasks,
  disabled,
}: {
  block: ConnectionCatalogBlock;
  tasks: ConnectionCatalogTask[];
  subtasks: ConnectionCatalogSubtask[];
  disabled: boolean;
}) {
  const t = useTranslations("dashboard.tasks.connections");
  const tc = useTranslations("dashboard.routines.calendar");
  const { data, toggleConnection, updateConnection } = useConnections();

  const findConnection = (
    taskId?: string | null,
    subtaskId?: string | null,
  ): TaskBlockConnection | undefined => {
    if (!data) return undefined;
    return data.connections.find(
      (connection) =>
        connection.timeBlockId === block.id &&
        (taskId
          ? connection.taskId === taskId
          : connection.subtaskId === subtaskId),
    );
  };

  const updateFor = (
    connection: TaskBlockConnection | undefined,
    patch: ConnectionPatch,
  ) => {
    if (connection) void updateConnection(connection.id, patch);
  };

  const noEntities = tasks.length === 0 && subtasks.length === 0;

  return (
    <div
      className={cn(
        "border-border/60 relative overflow-hidden rounded-xl border p-3.5",
        blockTintClass(block.color),
      )}
    >
      <span
        className={cn(
          "absolute inset-y-0 left-0 w-1.5",
          blockBorderClass(block.color),
        )}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2 pl-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "size-2.5 shrink-0 rounded-full",
                blockBorderClass(block.color),
              )}
            />
            <p className="truncate text-sm font-semibold">{block.title}</p>
          </div>
          <p className="text-muted-foreground truncate text-xs pl-[18px]">
            {block.routineName}
          </p>
        </div>
        <Chip tone="muted">
          {tc(`confirmationOption_${block.confirmation}`)}
        </Chip>
        {!block.routineActive && (
          <Chip tone="warning">{t("routineInactive")}</Chip>
        )}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3 pl-2">
        <WeekStrip
          frequency={block.frequency}
          weekday={block.weekday}
          color={block.color}
        />
        <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
          <Clock className="size-3" />
          {formatClockTime(block.startMinutes)}
        </span>
        <span className="text-muted-foreground text-[11px]">
          · {blockRecurrence(block.frequency, block.weekday, t)}
        </span>
      </div>

      <div className="space-y-2">
        {tasks.map((task) => (
          <ConnectionRow
            key={task.id}
            title={task.title}
            subtitle={t("taskBadge")}
            accentColor={block.color}
            connection={findConnection(task.id, null)}
            disabled={disabled}
            frequency={block.frequency}
            blockWeekday={block.weekday}
            color={block.color}
            onToggle={() =>
              void toggleConnection({
                taskId: task.id,
                timeBlockId: block.id,
              })
            }
            onUpdate={(patch) =>
              updateFor(findConnection(task.id, null), patch)
            }
          />
        ))}
        {subtasks.map((subtask) => (
          <ConnectionRow
            key={subtask.id}
            title={subtask.title}
            subtitle={subtask.taskTitle}
            accentColor={block.color}
            connection={findConnection(null, subtask.id)}
            disabled={disabled}
            frequency={block.frequency}
            blockWeekday={block.weekday}
            color={block.color}
            onToggle={() =>
              void toggleConnection({
                subtaskId: subtask.id,
                timeBlockId: block.id,
              })
            }
            onUpdate={(patch) =>
              updateFor(findConnection(null, subtask.id), patch)
            }
          />
        ))}
        {noEntities && (
          <p className="text-muted-foreground px-2 py-1 text-xs">
            {t("noMatches")}
          </p>
        )}
      </div>
    </div>
  );
}

function EntitiesTab({
  matches,
}: {
  matches: (title: string) => boolean;
}) {
  const t = useTranslations("dashboard.tasks.connections");
  const { data } = useConnections();

  if (!data) return null;
  const taskIdsWithMatchedSubtasks = new Set(
    data.subtasks
      .filter((subtask) => matches(subtask.title))
      .map((s) => s.taskId),
  );
  const tasks = data.tasks.filter(
    (task) => matches(task.title) || taskIdsWithMatchedSubtasks.has(task.id),
  );

  if (data.tasks.length === 0 && data.subtasks.length === 0) {
    return <EmptyHint>{t("noTasks")}</EmptyHint>;
  }
  if (tasks.length === 0) return <EmptyHint>{t("noMatches")}</EmptyHint>;

  const blocks = data.blocks.filter((block) => matches(block.title));

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          subtasks={data.subtasks.filter((subtask) => subtask.taskId === task.id)}
          blocks={blocks}
        />
      ))}
    </div>
  );
}

function TaskCard({
  task,
  subtasks,
  blocks,
}: {
  task: ConnectionCatalogTask;
  subtasks: ConnectionCatalogSubtask[];
  blocks: ConnectionCatalogBlock[];
}) {
  const t = useTranslations("dashboard.tasks.connections");
  const tTasks = useTranslations("dashboard.tasks");
  const { data, toggleConnection, updateConnection } = useConnections();

  const findConnection = (
    blockId: string,
    subtaskId?: string,
  ): TaskBlockConnection | undefined => {
    if (!data) return undefined;
    return data.connections.find(
      (connection) =>
        connection.timeBlockId === blockId &&
        (subtaskId
          ? connection.subtaskId === subtaskId
          : connection.taskId === task.id),
    );
  };

  const updateFor = (
    connection: TaskBlockConnection | undefined,
    patch: ConnectionPatch,
  ) => {
    if (connection) void updateConnection(connection.id, patch);
  };

  return (
    <div className="border-border/60 relative overflow-hidden rounded-xl border p-3.5">
      <span className="bg-event-blue-border absolute inset-y-0 left-0 w-1.5" />
      <div className="mb-3 flex items-center gap-2 pl-2">
        <span className="bg-event-blue-bg text-event-blue flex size-6 shrink-0 items-center justify-center rounded-md">
          <ListChecks className="size-3.5" />
        </span>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">
          {task.title}
        </p>
        {task.done && <Chip tone="success">{tTasks("done")}</Chip>}
      </div>

      <div className="space-y-2">
        {blocks.map((block) => {
          const disabled =
            block.confirmation === "none" || !block.routineActive;
          return (
            <ConnectionRow
              key={block.id}
              title={block.title}
              subtitle={`${block.routineName} · ${blockRecurrence(
                block.frequency,
                block.weekday,
                t,
              )}`}
              accentColor={block.color}
              connection={findConnection(block.id)}
              disabled={disabled}
              frequency={block.frequency}
              blockWeekday={block.weekday}
              color={block.color}
              onToggle={() =>
                void toggleConnection({
                  taskId: task.id,
                  timeBlockId: block.id,
                })
              }
              onUpdate={(patch) =>
                updateFor(findConnection(block.id), patch)
              }
            />
          );
        })}

        {subtasks.map((subtask) => (
          <div key={subtask.id} className="space-y-2">
            <p className="text-muted-foreground flex items-center gap-1.5 px-1 pt-1 text-[11px] font-medium uppercase tracking-wide">
              <span className="bg-event-blue-bg text-event-blue flex size-4 items-center justify-center rounded-sm">
                <ListChecks className="size-2.5" />
              </span>
              {subtask.title}
              {subtask.done && <Chip tone="success">{tTasks("done")}</Chip>}
            </p>
            {blocks.map((block) => {
              const disabled =
                block.confirmation === "none" || !block.routineActive;
              return (
                <ConnectionRow
                  key={block.id}
                  title={block.title}
                  subtitle={`${block.routineName} · ${blockRecurrence(
                    block.frequency,
                    block.weekday,
                    t,
                  )}`}
                  accentColor={block.color}
                  connection={findConnection(block.id, subtask.id)}
                  disabled={disabled}
                  frequency={block.frequency}
                  blockWeekday={block.weekday}
                  color={block.color}
                  onToggle={() =>
                    void toggleConnection({
                      subtaskId: subtask.id,
                      timeBlockId: block.id,
                    })
                  }
                  onUpdate={(patch) =>
                    updateFor(findConnection(block.id, subtask.id), patch)
                  }
                />
              );
            })}
          </div>
        ))}

        {blocks.length === 0 && (
          <p className="text-muted-foreground px-2 py-1 text-xs">
            {(data?.blocks.length ?? 0) === 0 ? t("noBlocks") : t("noMatches")}
          </p>
        )}
      </div>
    </div>
  );
}

function ConnectionRow({
  title,
  subtitle,
  accentColor,
  connection,
  disabled,
  frequency,
  blockWeekday,
  color,
  onToggle,
  onUpdate,
}: {
  title: string;
  subtitle?: string;
  accentColor?: EventColor;
  connection: TaskBlockConnection | undefined;
  disabled?: boolean;
  frequency: Frequency;
  blockWeekday: number;
  color: EventColor;
  onToggle: () => void;
  onUpdate: (patch: ConnectionPatch) => void;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-2.5 py-1.5 transition-colors",
        connection ? "bg-background/80 border-border/70" : "border-transparent",
        disabled && !connection && "opacity-60",
      )}
    >
      <label className="flex cursor-pointer items-center gap-2.5">
        {accentColor && (
          <span
            className={cn(
              "size-2.5 shrink-0 rounded-sm",
              blockBorderClass(accentColor),
            )}
          />
        )}
        <Checkbox
          checked={!!connection}
          disabled={disabled && !connection}
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
        {connection && <StatusChip connection={connection} />}
      </label>
      {connection && !disabled && (
        <ConnectionOptionsPanel
          connection={connection}
          frequency={frequency}
          blockWeekday={blockWeekday}
          color={color}
          onUpdate={onUpdate}
        />
      )}
    </div>
  );
}

function StatusChip({ connection }: { connection: TaskBlockConnection }) {
  const t = useTranslations("dashboard.tasks.connections");
  const satisfied = connection.confirmedCount >= connection.requiredCount;

  return (
    <span
      className={cn(
        "flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
        satisfied
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
      )}
    >
      {satisfied ? (
        <CheckCircle2 className="size-3" />
      ) : (
        <Clock className="size-3" />
      )}
      {satisfied ? t("satisfied") : t("pending")}
    </span>
  );
}

function ConnectionOptionsPanel({
  connection,
  frequency,
  blockWeekday,
  color,
  onUpdate,
}: {
  connection: TaskBlockConnection;
  frequency: Frequency;
  blockWeekday: number;
  color: EventColor;
  onUpdate: (patch: ConnectionPatch) => void;
}) {
  const t = useTranslations("dashboard.tasks.connections");
  const [dateError, setDateError] = React.useState(false);

  const isDate = isDateFilter(connection.dayFilter);
  const currentValid = isDayFilterSatisfiable(
    connection.dayFilter,
    frequency,
    blockWeekday,
  );
  const satisfied = connection.confirmedCount >= connection.requiredCount;
  const progress = Math.min(
    100,
    Math.round((connection.confirmedCount / connection.requiredCount) * 100),
  );

  const selectValue = currentValid
    ? isDate
      ? "date:"
      : connection.dayFilter
    : "all";

  return (
    <div className="border-border/60 mt-2 flex flex-col gap-2 border-t pt-2 pl-8">
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground text-xs">
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
            disabled={isDate}
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

      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-xs">{t("dayFilter")}</span>
        <Select
          value={selectValue}
          onValueChange={(value) => {
            setDateError(false);
            if (value === "date:") {
              const date =
                frequency === "weekly"
                  ? nextDateForWeekday(blockWeekday)
                  : todayLocal();
              // Filtro de data exige exatamente 1 confirmação (isRequiredCountReachable).
              onUpdate({ dayFilter: `date:${date}`, requiredCount: 1 });
            } else {
              onUpdate({ dayFilter: value as DayFilter });
            }
          }}
        >
          <SelectTrigger className="h-7 gap-1 px-2 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {dayFilterOptions(frequency, blockWeekday).map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {t(option.labelKey)}
              </SelectItem>
            ))}
            <SelectItem value="date:">{t("specificDate")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isDate && (
        <p className="text-muted-foreground text-[11px]">
          {t("dateCountHint")}
        </p>
      )}

      {isDate && (
        <div className="flex items-center gap-2">
          <CalendarDays className="text-muted-foreground size-3.5" />
          <Input
            type="date"
            value={dayFilterDate(connection.dayFilter)}
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
            className="h-7 w-fit text-xs"
          />
        </div>
      )}
      {isDate && frequency === "weekly" && (
        <p
          className={
            dateError
              ? "text-destructive text-[11px]"
              : "text-muted-foreground text-[11px]"
          }
        >
          {dateError
            ? t("dateInvalidWeekly", { day: t(`weekday_${blockWeekday}`) })
            : t("dateHintWeekly", { day: t(`weekday_${blockWeekday}`) })}
        </p>
      )}

      {!currentValid && (
        <div className="bg-muted/50 flex flex-col gap-1.5 rounded-sm px-2 py-1.5">
          <p className="text-muted-foreground text-[11px] leading-snug">
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

      <div className="flex items-center justify-between gap-2">
        <span
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
          {dayFilterLabel(connection.dayFilter, t)}
        </span>
      </div>
      <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            satisfied ? "bg-emerald-500 dark:bg-emerald-400" : blockBorderClass(color),
          )}
          style={{ width: `${progress}%` }}
        />
      </div>

      {!satisfied && connection.countedBefore > 0 && (
        <p className="text-muted-foreground text-[11px]">
          {t("countedBefore", { count: connection.countedBefore })}
        </p>
      )}
    </div>
  );
}

function Chip({
  tone,
  children,
}: {
  tone: "muted" | "warning" | "success";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium",
        tone === "muted" && "text-muted-foreground border-border bg-muted/50",
        tone === "warning" &&
          "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
        tone === "success" &&
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      )}
    >
      {children}
    </span>
  );
}