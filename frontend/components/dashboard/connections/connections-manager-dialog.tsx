"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock,
  Link2,
  ListChecks,
  Minus,
  Plus,
  Search,
  Sparkles,
  Trash2,
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
import { LUCIDE_ICON_MAP } from "@/lib/lucide-icons";
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
} from "@/components/connections/connection-colors";
import type {
  ConnectionCatalogBlock,
  ConnectionCatalogHabit,
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

type Tab = "links" | "explorer";

function DialogBody() {
  const t = useTranslations("dashboard.connections");
  const tc = useTranslations("dashboard.tasks.connections");
  const { data, isLoading } = useConnections();
  const [tab, setTab] = React.useState<Tab>("links");
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
                  active={tab === "links"}
                  onClick={() => setTab("links")}
                >
                  {tc("tabLinks")}
                </TabButton>
                <TabButton
                  active={tab === "explorer"}
                  onClick={() => setTab("explorer")}
                >
                  {tc("tabExplorer")}
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

            {tab === "links" ? (
              <LinksTab matches={matches} onGoToExplorer={() => setTab("explorer")} />
            ) : (
              <ExplorerTab matches={matches} />
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
  return (
    <div className="border-border/60 bg-muted/30 flex flex-wrap items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-2.5">
      <FlowBox
        icon={<ListChecks className="size-3.5" />}
        labelKey="how.flowTask"
        tone="bg-event-blue-bg text-event-blue"
      />
      <ArrowRight className="text-muted-foreground size-4 shrink-0" />
      <FlowBox
        icon={<Sparkles className="size-3.5" />}
        labelKey="how.flowHabit"
        tone="bg-event-orange-bg text-event-orange"
      />
      <ArrowRight className="text-muted-foreground size-4 shrink-0" />
      <FlowBox
        icon={<Clock className="size-3.5" />}
        labelKey="how.flowBlock"
        tone="bg-event-purple-bg text-event-purple"
      />
      <ArrowRight className="text-muted-foreground size-4 shrink-0" />
      <FlowBox
        icon={<CheckCircle2 className="size-3.5" />}
        labelKey="how.flowDone"
        tone="bg-event-green-bg text-event-green"
      />
    </div>
  );
}

function FlowBox({
  icon,
  labelKey,
  tone,
}: {
  icon: React.ReactNode;
  labelKey: string;
  tone: string;
}) {
  const t = useTranslations("dashboard.connections");
  return (
    <span
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium",
        tone,
      )}
    >
      {icon}
      {t(labelKey)}
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
    data?.connections.map((connection) =>
      connection.taskId ??
      connection.subtaskId ??
      connection.habitId ??
      "",
    ).filter((key) => key !== ""),
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

/* ------------------------------------------------------------------ */
/* Aba Vinculações: conexões ativas agrupadas por bloco                 */
/* ------------------------------------------------------------------ */

function LinksTab({
  matches,
  onGoToExplorer,
}: {
  matches: (title: string) => boolean;
  onGoToExplorer: () => void;
}) {
  const t = useTranslations("dashboard.tasks.connections");
  const { data } = useConnections();

  if (!data) return null;

  if (data.connections.length === 0) {
    return (
      <div className="border-border/60 flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-12 text-center">
        <div className="bg-muted flex size-12 items-center justify-center rounded-full">
          <Link2 className="text-muted-foreground size-5" />
        </div>
        <div className="space-y-0.5">
          <p className="text-sm font-medium">{t("linksEmptyTitle")}</p>
          <p className="text-muted-foreground text-sm">
            {t("linksEmptyDescription")}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onGoToExplorer}>
          <Search className="size-3.5" />
          {t("goToExplorer")}
        </Button>
      </div>
    );
  }

  // Busca casa com o título do bloco OU da entidade vinculada.
  const entityTitle = (connection: TaskBlockConnection): string => {
    if (connection.taskId) {
      return (
        data.tasks.find((task) => task.id === connection.taskId)?.title ?? ""
      );
    }
    if (connection.subtaskId) {
      return (
        data.subtasks.find((s) => s.id === connection.subtaskId)?.title ?? ""
      );
    }
    return (
      data.habits.find((habit) => habit.id === connection.habitId)?.name ?? ""
    );
  };
  const visible = data.connections.filter(
    (connection) =>
      matches(entityTitle(connection)) ||
      matches(
        data.blocks.find((block) => block.id === connection.timeBlockId)
          ?.title ?? "",
      ),
  );
  if (visible.length === 0) return <EmptyHint>{t("noMatches")}</EmptyHint>;

  // Agrupa por bloco preservando a ordem do catálogo; pendentes primeiro.
  // Conexões cujo bloco sumiu ganham grupo próprio para poderem ser removidas.
  const byBlock = new Map<string | null, TaskBlockConnection[]>();
  for (const connection of visible) {
    const list = byBlock.get(connection.timeBlockId) ?? [];
    list.push(connection);
    byBlock.set(connection.timeBlockId, list);
  }

  const groups = [...byBlock.entries()].map(([blockId, connections]) => ({
    block: data.blocks.find((block) => block.id === blockId) ?? null,
    connections: [...connections].sort(
      (a, b) =>
        Number(a.confirmedCount >= a.requiredCount) -
        Number(b.confirmedCount >= b.requiredCount),
    ),
  }));

  return (
    <div className="space-y-3">
      {groups.map(({ block, connections }) =>
        block ? (
          <LinkGroup key={block.id} block={block} connections={connections} />
        ) : (
          <OrphanLinkGroup
            key="orphan"
            connections={connections}
          />
        ),
      )}
    </div>
  );
}

function OrphanLinkGroup({
  connections,
}: {
  connections: TaskBlockConnection[];
}) {
  const t = useTranslations("dashboard.tasks.connections");
  const { toggleConnection } = useConnections();

  return (
    <div className="border-destructive/30 bg-destructive/5 relative overflow-hidden rounded-xl border p-3.5">
      <span className="bg-destructive/40 absolute inset-y-0 left-0 w-1.5" />
      <p className="text-destructive mb-2 pl-2 text-xs font-semibold">
        {t("orphanBlockTitle")}
      </p>
      <ul className="space-y-1.5 pl-2">
        {connections.map((connection) => (
          <li
            key={connection.id}
            className="border-border/70 bg-background/80 flex items-center gap-2.5 rounded-lg border px-2.5 py-1.5"
          >
            <span className="min-w-0 flex-1 truncate text-sm">
              {connection.taskId
                ? t("taskBadge")
                : connection.subtaskId
                  ? t("subtaskBadge")
                  : t("habitBadge")}
            </span>
            <Button
              variant="ghost"
              size="icon-xs"
              className="text-muted-foreground hover:text-destructive"
              aria-label={t("removeConnection")}
              onClick={() =>
                void toggleConnection({
                  taskId: connection.taskId,
                  subtaskId: connection.subtaskId,
                  habitId: connection.habitId,
                  timeBlockId: connection.timeBlockId,
                })
              }
            >
              <Trash2 className="size-3.5" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LinkGroup({
  block,
  connections,
}: {
  block: ConnectionCatalogBlock;
  connections: TaskBlockConnection[];
}) {
  const t = useTranslations("dashboard.tasks.connections");
  const { toggleConnection } = useConnections();

  const satisfiedCount = connections.filter(
    (connection) => connection.confirmedCount >= connection.requiredCount,
  ).length;

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

      <div className="mb-2 flex flex-wrap items-center gap-2 pl-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{block.title}</p>
          <p className="text-muted-foreground truncate text-xs">
            {block.routineName} ·{" "}
            {blockRecurrence(block.frequency, block.weekday, t)}
          </p>
        </div>
        <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
          <Clock className="size-3" />
          {formatClockTime(block.startMinutes)}
        </span>
      </div>

      <ul className="space-y-1.5 pl-2">
        {connections.map((connection) => (
          <LinkRow
            key={connection.id}
            connection={connection}
            onRemove={() =>
              void toggleConnection({
                taskId: connection.taskId,
                subtaskId: connection.subtaskId,
                habitId: connection.habitId,
                timeBlockId: connection.timeBlockId,
              })
            }
          />
        ))}
      </ul>

      <p className="text-muted-foreground px-2 pt-2 text-[10px]">
        {t("groupSummary", {
          satisfied: satisfiedCount,
          total: connections.length,
        })}
      </p>
    </div>
  );
}

function LinkRow({
  connection,
  onRemove,
}: {
  connection: TaskBlockConnection;
  onRemove: () => void;
}) {
  const t = useTranslations("dashboard.tasks.connections");
  const { data, updateConnection } = useConnections();
  const [optionsOpen, setOptionsOpen] = React.useState(false);

  const task = data?.tasks.find((item) => item.id === connection.taskId);
  const subtask = data?.subtasks.find(
    (item) => item.id === connection.subtaskId,
  );
  const habit = data?.habits.find((item) => item.id === connection.habitId);

  const title =
    habit?.name ?? subtask?.title ?? task?.title ?? t("removedEntity");
  const subtitle = subtask
    ? subtask.taskTitle
    : habit
      ? t("habitBadge")
      : task
        ? t("taskBadge")
        : "";

  let iconNode: React.ReactNode;
  let iconTone: string | undefined;
  if (habit) {
    const HabitIcon = LUCIDE_ICON_MAP[habit.icon];
    iconNode = HabitIcon ? <HabitIcon className="size-3.5" /> : null;
    iconTone = cn(blockTintClass(habit.color), blockTextClass(habit.color));
  } else {
    iconNode = <ListChecks className="size-3.5" />;
    iconTone = "bg-event-blue-bg text-event-blue";
  }

  const block = data?.blocks.find(
    (item) => item.id === connection.timeBlockId,
  );

  return (
    <li className="border-border/70 bg-background/80 rounded-lg border px-2.5 py-1.5 transition-colors">
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-sm",
            iconTone,
          )}
        >
          {iconNode}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium">{title}</span>
          </span>
          <span className="text-muted-foreground block truncate text-xs">
            {subtitle}
          </span>
        </span>
        <StatusChip connection={connection} />
        <Button
          variant="ghost"
          size="icon-xs"
          aria-expanded={optionsOpen}
          aria-label={optionsOpen ? t("hideOptions") : t("showOptions")}
          onClick={() => setOptionsOpen((open) => !open)}
        >
          <ChevronDown
            className={cn(
              "size-3.5 transition-transform",
              optionsOpen && "rotate-180",
            )}
          />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground hover:text-destructive"
          aria-label={t("removeConnection")}
          onClick={onRemove}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      {optionsOpen && block && (
        <ConnectionOptionsPanel
          connection={connection}
          frequency={block.frequency}
          blockWeekday={block.weekday}
          color={block.color}
          onUpdate={(patch) => void updateConnection(connection.id, patch)}
        />
      )}
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Aba Explorador: entidade -> blocos                                   */
/* ------------------------------------------------------------------ */

function ExplorerTab({ matches }: { matches: (title: string) => boolean }) {
  const t = useTranslations("dashboard.tasks.connections");
  const { data } = useConnections();

  if (!data) return null;

  const goodHabits = data.habits.filter((habit) => habit.type === "good");
  const badOnly =
    data.habits.length > 0 &&
    goodHabits.length === 0 &&
    data.tasks.length === 0 &&
    data.subtasks.length === 0;

  const taskIdsWithMatchedSubtasks = new Set(
    data.subtasks
      .filter((subtask) => matches(subtask.title))
      .map((s) => s.taskId),
  );

  // Busca por título de bloco também superfície as entidades vinculadas a ele.
  const matchedBlockIds = new Set(
    data.blocks.filter((block) => matches(block.title)).map((b) => b.id),
  );
  const entityIdsOnMatchedBlocks = new Set(
    data.connections
      .filter((connection) => matchedBlockIds.has(connection.timeBlockId))
      .map((connection) =>
        connection.taskId ?? connection.subtaskId ?? connection.habitId ?? "",
      )
      .filter((key) => key !== ""),
  );

  const tasks = data.tasks.filter(
    (task) =>
      matches(task.title) ||
      taskIdsWithMatchedSubtasks.has(task.id) ||
      entityIdsOnMatchedBlocks.has(task.id),
  );
  const habits = goodHabits.filter(
    (habit) =>
      matches(habit.name) || entityIdsOnMatchedBlocks.has(habit.id),
  );
  // Dentro dos cartões, SEMPRE listamos todos os blocos: a busca seleciona
  // entidades, não esconde as opções de vínculo delas.
  const blocks = data.blocks;

  if (data.tasks.length === 0 && data.subtasks.length === 0 && data.habits.length === 0) {
    return <EmptyHint>{t("noTasks")}</EmptyHint>;
  }
  if (badOnly) return <EmptyHint>{t("onlyBadHabits")}</EmptyHint>;
  if (tasks.length === 0 && habits.length === 0) {
    return <EmptyHint>{t("noMatches")}</EmptyHint>;
  }

  return (
    <div className="space-y-4">
      {(tasks.length > 0 || data.subtasks.length > 0) && (
        <section className="space-y-2">
          <GroupLabel>{t("groupTasks")}</GroupLabel>
          {tasks.map((task) => (
            <TaskEntityCard
              key={task.id}
              task={task}
              subtasks={data.subtasks.filter(
                (subtask) => subtask.taskId === task.id,
              )}
              blocks={blocks}
            />
          ))}
        </section>
      )}

      {habits.length > 0 && (
        <section className="space-y-2">
          <GroupLabel>{t("groupHabits")}</GroupLabel>
          {habits.map((habit) => (
            <HabitEntityCard key={habit.id} habit={habit} blocks={blocks} />
          ))}
        </section>
      )}
    </div>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground px-1 text-[10px] font-semibold uppercase tracking-wider">
      {children}
    </p>
  );
}

function EntityCardShell({
  iconNode,
  iconTone,
  title,
  badge,
  meta,
  expanded,
  onToggleExpand,
  connectedCount,
  children,
}: {
  iconNode: React.ReactNode;
  iconTone: string;
  title: string;
  badge?: React.ReactNode;
  meta?: string;
  expanded: boolean;
  onToggleExpand: () => void;
  connectedCount: number;
  children: React.ReactNode;
}) {
  const t = useTranslations("dashboard.tasks.connections");

  return (
    <div className="border-border/60 overflow-hidden rounded-xl border bg-card">
      <button
        type="button"
        onClick={onToggleExpand}
        aria-expanded={expanded}
        className="hover:bg-muted/40 flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors"
      >
        <span
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-md",
            iconTone,
          )}
        >
          {iconNode}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold">{title}</span>
            {badge}
          </span>
          {meta && (
            <span className="text-muted-foreground block truncate text-xs">
              {meta}
            </span>
          )}
        </span>
        {connectedCount > 0 && (
          <Chip tone="muted">{t("badgeTitle", { count: connectedCount })}</Chip>
        )}
        <ChevronDown
          className={cn(
            "text-muted-foreground size-4 shrink-0 transition-transform",
            expanded && "rotate-180",
          )}
        />
      </button>
      {expanded && <div className="space-y-2 border-t px-3 py-3">{children}</div>}
    </div>
  );
}

function HabitEntityCard({
  habit,
  blocks,
}: {
  habit: ConnectionCatalogHabit;
  blocks: ConnectionCatalogBlock[];
}) {
  const t = useTranslations("dashboard.tasks.connections");
  const tHabits = useTranslations("dashboard.habits");
  const { data, toggleConnection, updateConnection } = useConnections();

  const [expanded, setExpanded] = React.useState(false);

  const IconComponent = LUCIDE_ICON_MAP[habit.icon];
  const connectedCount = data?.connections.filter(
    (connection) => connection.habitId === habit.id,
  ).length ?? 0;

  const meta =
    habit.frequency === "weekly"
      ? tHabits("frequency.weekly")
      : tHabits("frequency.everyday");

  const findConnection = (
    blockId: string,
  ): TaskBlockConnection | undefined =>
    data?.connections.find(
      (connection) =>
        connection.timeBlockId === blockId &&
        connection.habitId === habit.id,
    );

  const updateFor = (
    connection: TaskBlockConnection | undefined,
    patch: ConnectionPatch,
  ) => {
    if (connection) void updateConnection(connection.id, patch);
  };

  return (
    <EntityCardShell
      iconNode={IconComponent ? <IconComponent className="size-3.5" /> : null}
      iconTone={cn(blockTintClass(habit.color), blockTextClass(habit.color))}
      title={habit.name}
      meta={meta}
      expanded={expanded}
      onToggleExpand={() => setExpanded((value) => !value)}
      connectedCount={connectedCount}
    >
      {blocks.map((block) => {
        const disabled =
          block.confirmation === "none" || !block.routineActive;
        const connection = findConnection(block.id);
        return (
          <ConnectionCheckboxRow
            key={block.id}
            block={block}
            checked={!!connection}
            disabled={disabled}
            onCheckedChange={() =>
              void toggleConnection({
                habitId: habit.id,
                timeBlockId: block.id,
              })
            }
            connection={connection}
            onUpdate={(patch) => updateFor(findConnection(block.id), patch)}
          />
        );
      })}
      {blocks.length === 0 && (
        <p className="text-muted-foreground px-1 py-1 text-xs">
          {(data?.blocks.length ?? 0) === 0 ? t("noBlocks") : t("noMatches")}
        </p>
      )}
    </EntityCardShell>
  );
}

function TaskEntityCard({
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

  const [expanded, setExpanded] = React.useState(false);

  const subtaskIds = new Set(subtasks.map((subtask) => subtask.id));
  const connectedCount = data?.connections.filter(
    (connection) =>
      connection.taskId === task.id ||
      (connection.subtaskId !== null &&
        subtaskIds.has(connection.subtaskId)),
  ).length ?? 0;

  const findConnection = (
    blockId: string,
    subtaskId?: string,
  ): TaskBlockConnection | undefined =>
    data?.connections.find(
      (connection) =>
        connection.timeBlockId === blockId &&
        (subtaskId
          ? connection.subtaskId === subtaskId
          : connection.taskId === task.id),
    );

  const updateFor = (
    connection: TaskBlockConnection | undefined,
    patch: ConnectionPatch,
  ) => {
    if (connection) void updateConnection(connection.id, patch);
  };

  return (
    <EntityCardShell
      iconNode={<ListChecks className="size-3.5" />}
      iconTone="bg-event-blue-bg text-event-blue"
      title={task.title}
      badge={task.done ? <Chip tone="success">{tTasks("done")}</Chip> : null}
      expanded={expanded}
      onToggleExpand={() => setExpanded((value) => !value)}
      connectedCount={connectedCount}
    >
      {blocks.map((block) => {
        const disabled =
          block.confirmation === "none" || !block.routineActive;
        return (
          <ConnectionCheckboxRow
            key={block.id}
            block={block}
            checked={!!findConnection(block.id)}
            disabled={disabled}
            onCheckedChange={() =>
              void toggleConnection({
                taskId: task.id,
                timeBlockId: block.id,
              })
            }
            connection={findConnection(block.id)}
            onUpdate={(patch) => updateFor(findConnection(block.id), patch)}
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
              <ConnectionCheckboxRow
                key={block.id}
                block={block}
                checked={!!findConnection(block.id, subtask.id)}
                disabled={disabled}
                onCheckedChange={() =>
                  void toggleConnection({
                    subtaskId: subtask.id,
                    timeBlockId: block.id,
                  })
                }
                connection={findConnection(block.id, subtask.id)}
                onUpdate={(patch) =>
                  updateFor(findConnection(block.id, subtask.id), patch)
                }
              />
            );
          })}
        </div>
      ))}

      {blocks.length === 0 && (
        <p className="text-muted-foreground px-1 py-1 text-xs">
          {(data?.blocks.length ?? 0) === 0 ? t("noBlocks") : t("noMatches")}
        </p>
      )}
    </EntityCardShell>
  );
}

/** Linha de vínculo no explorador: checkbox liga/desliga + painel quando ligado. */
function ConnectionCheckboxRow({
  block,
  checked,
  disabled,
  onCheckedChange,
  connection,
  onUpdate,
}: {
  block: ConnectionCatalogBlock;
  checked: boolean;
  disabled: boolean;
  onCheckedChange: () => void;
  connection: TaskBlockConnection | undefined;
  onUpdate: (patch: ConnectionPatch) => void;
}) {
  const t = useTranslations("dashboard.tasks.connections");
  const [optionsOpen, setOptionsOpen] = React.useState(false);

  return (
    <div
      className={cn(
        "rounded-lg border px-2.5 py-1.5 transition-colors",
        checked ? "bg-background/80 border-border/70" : "border-transparent",
        disabled && !checked && "opacity-60",
      )}
    >
      <div className="flex items-center gap-2.5">
        <label
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2.5",
            !disabled && "cursor-pointer",
          )}
        >
          <Checkbox
            checked={checked}
            disabled={disabled && !checked}
            onCheckedChange={onCheckedChange}
            className="shrink-0"
          />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">
              {block.title}
            </span>
            <span className="text-muted-foreground block truncate text-xs">
              {block.routineName} ·{" "}
              {blockRecurrence(block.frequency, block.weekday, t)} ·{" "}
              {formatClockTime(block.startMinutes)}
            </span>
          </span>
        </label>
        {checked && <StatusChip connection={connection!} />}
        {checked && !disabled && (
          <Button
            variant="ghost"
            size="icon-xs"
            aria-expanded={optionsOpen}
            aria-label={optionsOpen ? t("hideOptions") : t("showOptions")}
            onClick={() => setOptionsOpen((open) => !open)}
          >
            <ChevronDown
              className={cn(
                "size-3.5 transition-transform",
                optionsOpen && "rotate-180",
              )}
            />
          </Button>
        )}
      </div>

      {checked && !disabled && optionsOpen && connection && (
        <ConnectionOptionsPanel
          connection={connection}
          frequency={block.frequency}
          blockWeekday={block.weekday}
          color={block.color}
          onUpdate={onUpdate}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Peças compartilhadas                                                 */
/* ------------------------------------------------------------------ */

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
