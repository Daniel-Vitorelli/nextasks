"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  CheckCircle2,
  Clock,
  GitBranch,
  ListChecks,
  Medal,
  Sparkles,
  Target,
  Trophy,
  XCircle,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { RANKS } from "@/lib/gamification/ranks";
import {
  blockBorderClass,
  blockTextClass,
  solidTextOnColor,
} from "@/components/connections/connection-colors";
import { LUCIDE_ICON_MAP } from "@/lib/lucide-icons";
import { xpKindLabelKey } from "@/lib/gamification/kinds";
import { Flame, Shield } from "lucide-react";
import type {
  AchievementTier,
  RankDef,
  XpEventRow,
} from "@/types/domain";
import { useGamification } from "@/hooks/use-gamification";
import { XP_AMOUNTS } from "@/lib/gamification/rules";

type Tab = "achievements" | "history" | "how";
type TierFilter = AchievementTier | "all";
type StatusFilter = "all" | "unlocked" | "locked";
type HistoryFilter = "all" | "gains" | "losses";

const TIER_ORDER: AchievementTier[] = ["platinum", "gold", "silver", "bronze"];

export default function GamificationPage() {
  const t = useTranslations("app.gamification");
  const locale = useLocale();
  const { summary, isLoading } = useGamification();
  const [tab, setTab] = React.useState<Tab>("achievements");
  const [tierFilter, setTierFilter] = React.useState<TierFilter>("all");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [historyFilter, setHistoryFilter] =
    React.useState<HistoryFilter>("all");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-10 px-4 py-12 md:px-8">
      <header className="space-y-1.5">
        <p className="font-jetbrainsMono text-sm text-muted-foreground uppercase tracking-[0.2em]">
          {t("eyebrow")}
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {t("title")}
        </h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </header>

      {isLoading || !summary ? (
        <div className="flex items-center justify-center rounded-xl border border-border/60 bg-card py-16">
          <Spinner className="size-6" />
        </div>
      ) : (
        <>
          {/* Cabeçalho: anel de nível + rank */}
          <Card>
            <CardContent className="flex flex-col gap-4 p-4 sm:gap-6 sm:p-6">
              {/* Linha 1: anel + info de nível/rank/XP */}
              <div className="flex items-center gap-4 sm:gap-6">
                <LevelRing
                  level={summary.level}
                  progress={summary.levelProgress}
                />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <RankBadge rank={summary.rank} />
                    {summary.nextRank && (
                      <span className="text-muted-foreground text-xs">
                        {t("nextRankIn", {
                          levels: summary.nextRank.minLevel - summary.level,
                        })}
                      </span>
                    )}
                  </div>
                  <p className="font-jetbrainsMono text-2xl font-bold tabular-nums sm:text-3xl">
                    {summary.totalXp.toLocaleString(locale)}{" "}
                    <span className="text-base font-medium">XP</span>
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {t("xpToNext", { amount: summary.xpToNextLevel })}
                  </p>
                </div>
              </div>

              {/* Linha 2: contador de conquistas (separado por divisor) */}
              <div className="border-border/60 flex items-center justify-between gap-3 border-t pt-4">
                <p className="text-muted-foreground text-[11px] uppercase tracking-wide">
                  {t("unlocked")}
                </p>
                <p className="text-xl font-bold tabular-nums">
                  {summary.unlockedCount}
                  <span className="text-muted-foreground text-sm font-medium">
                    /{summary.achievements.length}
                  </span>
                </p>
              </div>

              {/* Linha 3: escada de ranks */}
              <RankLadder
                ranks={[summary.rank, ...getFutureRanks(summary)]}
                currentLevel={summary.level}
                currentRankId={summary.rank.id}
              />
            </CardContent>
          </Card>

          <div className="grid gap-3 md:grid-cols-2">
            <RecordsCard
              currentRoutineStreak={summary.currentRoutineStreak}
              bestRoutineStreak={summary.bestRoutineStreak}
              currentCleanStreak={summary.currentCleanStreak}
              bestCleanStreak={summary.bestCleanStreak}
            />
            <BreakdownCard breakdown={summary.breakdown} />
          </div>

          {/* Abas */}
          <div className="bg-muted/60 flex w-fit items-center gap-1 rounded-lg p-1">
            {(["achievements", "history", "how"] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                aria-pressed={tab === key}
                className={cnTabs(tab === key)}
              >
                {t(`tabs.${key}`)}
              </button>
            ))}
          </div>

          {tab === "achievements" && (
            <div className="space-y-4">
              <NextAchievementCallout summary={summary} />

              {/* Filtros por tier e status */}
              <div className="flex flex-wrap items-center gap-2">
                <FilterChip
                  active={tierFilter === "all"}
                  onClick={() => setTierFilter("all")}
                  label={t("filters.allTiers")}
                />
                {(["bronze", "silver", "gold", "platinum"] as const).map(
                  (tier) => (
                    <FilterChip
                      key={tier}
                      active={tierFilter === tier}
                      onClick={() => setTierFilter(tier)}
                      label={t(`tiers.${tier}`)}
                    />
                  ),
                )}
                <span className="bg-border mx-1 h-4 w-px" aria-hidden />
                <FilterChip
                  active={statusFilter === "all"}
                  onClick={() => setStatusFilter("all")}
                  label={t("filters.allStatus")}
                />
                <FilterChip
                  active={statusFilter === "unlocked"}
                  onClick={() => setStatusFilter("unlocked")}
                  label={t("filters.unlocked")}
                />
                <FilterChip
                  active={statusFilter === "locked"}
                  onClick={() => setStatusFilter("locked")}
                  label={t("filters.locked")}
                />
              </div>

              <AchievementsGrid
                summary={summary}
                tierFilter={tierFilter}
                statusFilter={statusFilter}
              />
            </div>
          )}
          {tab === "history" && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <FilterChip
                  active={historyFilter === "all"}
                  onClick={() => setHistoryFilter("all")}
                  label={t("history.filters.all")}
                />
                <FilterChip
                  active={historyFilter === "gains"}
                  onClick={() => setHistoryFilter("gains")}
                  label={t("history.filters.gains")}
                />
                <FilterChip
                  active={historyFilter === "losses"}
                  onClick={() => setHistoryFilter("losses")}
                  label={t("history.filters.losses")}
                />
              </div>
              <HistoryList events={summary.recentEvents} filter={historyFilter} />
            </div>
          )}
          {tab === "how" && <HowToEarn />}
        </>
      )}
    </main>
  );
}

function cnTabs(active: boolean): string {
  return cn(
    "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
    active
      ? "bg-background text-foreground shadow-sm"
      : "text-muted-foreground hover:text-foreground",
  );
}

function LevelRing({
  level,
  progress,
}: {
  level: number;
  progress: number;
}) {
  const size = 96;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress / 100)}
          className="stroke-primary transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-muted-foreground text-[10px] uppercase tracking-wide">
          Nv
        </span>
        <span className="text-2xl font-bold tabular-nums">{level}</span>
      </div>
    </div>
  );
}

function RankBadge({ rank }: { rank: RankDef }) {
  const t = useTranslations("app.gamification");
  const IconComponent =
    LUCIDE_ICON_MAP[rank.icon] ?? LUCIDE_ICON_MAP.Trophy;

  return (
    <span className="flex items-center gap-2.5">
      {/* Medalhão: fundo sólido na cor do rank, texto legível por cima. */}
      <span
        title={t("rankMinLevel", { level: rank.minLevel })}
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-full shadow-md",
          blockBorderClass(rank.color),
          solidTextOnColor[rank.color],
        )}
      >
        <IconComponent className="size-5" />
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            "block text-sm font-bold",
            blockTextClass(rank.color),
          )}
        >
          {t(rank.nameKey)}
        </span>
        <span className="text-muted-foreground block text-[11px]">
          {t("rankLabel")}
        </span>
      </span>
    </span>
  );
}

function AchievementsGrid({
  summary,
  tierFilter,
  statusFilter,
}: {
  summary: NonNullable<ReturnType<typeof useGamification>["summary"]>;
  tierFilter: TierFilter;
  statusFilter: StatusFilter;
}) {
  const t = useTranslations("app.gamification");
  const filtered = summary.achievements.filter((achievement) => {
    if (tierFilter !== "all" && achievement.tier !== tierFilter) return false;
    const unlocked = achievement.unlockedAt !== null;
    if (statusFilter === "unlocked" && !unlocked) return false;
    if (statusFilter === "locked" && unlocked) return false;
    return true;
  });

  const grouped = TIER_ORDER.map((tier) => ({
    tier,
    items: filtered.filter((a) => a.tier === tier),
  })).filter((group) => group.items.length > 0);

  if (grouped.length === 0) {
    return (
      <p className="text-muted-foreground rounded-xl border border-dashed border-border/60 py-10 text-center text-sm">
        {t("filters.noResults")}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {grouped.map(({ tier, items }) => (
        <section key={tier} className="space-y-2">
          <GroupLabel tier={tier} />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((achievement) => (
              <AchievementTile key={achievement.id} achievement={achievement} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function GroupLabel({ tier }: { tier: AchievementTier }) {
  const t = useTranslations("app.gamification");
  return (
    <p className="text-muted-foreground px-1 text-[11px] font-semibold uppercase tracking-wider">
      {t(`tiers.${tier}`)}
    </p>
  );
}

const TIER_TILE_STYLES: Record<AchievementTier, string> = {
  bronze: "border-orange-500/40 bg-orange-500/10 text-orange-600 dark:text-orange-400",
  silver: "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  gold: "border-yellow-500/50 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  platinum:
    "border-purple-500/40 bg-purple-500/10 text-purple-600 dark:text-purple-300",
};

function AchievementTile({
  achievement,
}: {
  achievement: NonNullable<
    ReturnType<typeof useGamification>["summary"]
  >["achievements"][number];
}) {
  const t = useTranslations("app.gamification");
  const ta = useTranslations("app.gamification.achievements");
  const unlocked = achievement.unlockedAt !== null;
  const IconComponent =
    LUCIDE_ICON_MAP[achievement.icon] ?? LUCIDE_ICON_MAP.CheckCircle2;

  return (
    <div
      className={
        unlocked
          ? TIER_TILE_STYLES[achievement.tier]
          : "border-border/60 bg-card/60 border opacity-70"
      }
    >
      <div className="flex h-full flex-col gap-2 p-3">
        <div className="flex items-start gap-2.5">
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg border bg-card",
              unlocked ? "" : "grayscale",
            )}
          >
            <IconComponent className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {ta(`${achievement.id}.name`)}
            </p>
            <p className="text-muted-foreground line-clamp-2 text-xs leading-snug">
              {ta(`${achievement.id}.description`)}
            </p>
          </div>
        </div>

        {!unlocked && (
          <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
            <div
              className="bg-primary h-full rounded-full"
              style={{ width: `${achievement.progress}%` }}
            />
          </div>
        )}

        <div className="flex items-center justify-between text-[10px] font-medium">
          <span className="text-muted-foreground uppercase tracking-wide">
            +{achievement.xpReward} XP
          </span>
          {unlocked ? (
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 className="size-3" /> {t("unlockedLabel")}
            </span>
          ) : (
            <span className="text-muted-foreground tabular-nums">
              {achievement.progress}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/** Ícone e tom por tipo de evento do ledger. */
const KIND_ICONS: Record<string, { icon: React.ReactNode }> = {
  blockConfirm: { icon: <Clock className="size-3.5" /> },
  taskDone: { icon: <ListChecks className="size-3.5" /> },
  subtaskDone: { icon: <GitBranch className="size-3.5" /> },
  habitConfirm: {
    icon: <CheckCircle2 className="size-3.5" />,
  },
  habitTarget: { icon: <Medal className="size-3.5" /> },
  habitSlip: { icon: <XCircle className="size-3.5 text-destructive" /> },
  routineDayFull: { icon: <Sparkles className="size-3.5" /> },
  achievement: { icon: <Trophy className="size-3.5" /> },
};

function HistoryList({
  events,
  filter,
}: {
  events: XpEventRow[];
  filter: HistoryFilter;
}) {
  const t = useTranslations("app.gamification.history");
  const locale = useLocale();

  const visible =
    filter === "all"
      ? events
      : events.filter((event) =>
          filter === "gains" ? event.amount >= 0 : event.amount < 0,
        );

  if (visible.length === 0) {
    return <EmptyBlock>{t("empty")}</EmptyBlock>;
  }

  // Agrupa por dia local (Hoje / Ontem / data).
  const now = new Date();
  const dayKeyOf = (iso: string) => {
    const date = new Date(iso);
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  };
  const todayKey = dayKeyOf(now.toISOString());
  const yesterdayKey = dayKeyOf(
    new Date(now.getTime() - 86_400_000).toISOString(),
  );
  const dayLabel = (key: string): string => {
    if (key === todayKey) return t("day.today");
    if (key === yesterdayKey) return t("day.yesterday");
    return new Intl.DateTimeFormat(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(new Date(`${key}-01T12:00:00Z`));
  };

  const sections: { key: string; events: XpEventRow[] }[] = [];
  for (const event of visible) {
    const key = dayKeyOf(event.createdAt);
    const last = sections[sections.length - 1];
    if (last && last.key === key) {
      last.events.push(event);
    } else {
      sections.push({ key, events: [event] });
    }
  }

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <section key={section.key} className="space-y-1">
          <p className="text-muted-foreground px-1 text-[10px] font-semibold uppercase tracking-wider">
            {dayLabel(section.key)}
          </p>
          <ul className="divide-y divide-border/60 rounded-xl border border-border/60 bg-card">
            {section.events.map((event) => {
              const kindMeta =
                KIND_ICONS[xpKindLabelKey(event.kind)] ?? KIND_ICONS.taskDone;
              return (
                <li
                  key={event.id}
                  className="flex items-center gap-3 px-4 py-2.5"
                >
                  <span className="bg-muted flex size-7 shrink-0 items-center justify-center rounded-md">
                    {kindMeta.icon}
                  </span>
                  <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs uppercase tracking-wide">
                    {t(`kinds.${xpKindLabelKey(event.kind)}`)}
                  </span>
                  <span
                    className={
                      event.amount >= 0
                        ? "font-jetbrainsMono text-sm font-bold text-emerald-600 dark:text-emerald-400"
                        : "font-jetbrainsMono text-destructive text-sm font-bold"
                    }
                  >
                    {event.amount >= 0 ? `+${event.amount}` : event.amount}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function EmptyBlock({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground rounded-xl border border-dashed border-border/60 py-10 text-center text-sm">
      {children}
    </p>
  );
}

function HowToEarn() {
  const t = useTranslations("app.gamification.how");

  const rows = [
    { label: t("rows.blockChecklist"), xp: XP_AMOUNTS.blockChecklist },
    { label: t("rows.blockScore"), xp: XP_AMOUNTS.blockScorePerPoint },
    { label: t("rows.taskDone"), xp: XP_AMOUNTS.taskDone },
    { label: t("rows.subtaskDone"), xp: XP_AMOUNTS.subtaskDone },
    { label: t("rows.habitConfirm"), xp: XP_AMOUNTS.habitConfirm },
    { label: t("rows.habitTargetBonus"), xp: XP_AMOUNTS.habitTargetBonus },
    { label: t("rows.habitSlip"), xp: XP_AMOUNTS.habitSlip },
    { label: t("rows.routineDayFull"), xp: XP_AMOUNTS.routineDayFull },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border/60">
          {rows.map((row) => (
            <li key={row.label} className="flex items-center justify-between gap-4 py-2.5">
              <span className="text-sm">{row.label}</span>
              <span
                className={
                  row.xp >= 0
                    ? "text-emerald-600 font-mono text-sm font-bold dark:text-emerald-400"
                    : "text-destructive font-mono text-sm font-bold"
                }
              >
                {row.xp >= 0 ? `+${row.xp}` : row.xp} XP
              </span>
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground mt-3 text-xs">{t("footnote")}</p>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Escada de ranks + callout de conquista mais próxima                  */
/* ------------------------------------------------------------------ */

function getFutureRanks(
  summary: NonNullable<ReturnType<typeof useGamification>["summary"]>,
): RankDef[] {
  const seen = new Set([summary.rank.id]);
  const future: RankDef[] = [];
  for (const rank of RANKS) {
    if (!seen.has(rank.id)) future.push(rank);
  }
  return future;
}

function RankLadder({
  ranks,
  currentLevel,
  currentRankId,
}: {
  ranks: RankDef[];
  currentLevel: number;
  currentRankId: string;
}) {
  const t = useTranslations("app.gamification");
  return (
    <div className="w-full">
      <p className="text-muted-foreground mb-1.5 text-[11px] uppercase tracking-wider">
        {t("rankLadder")}
      </p>
      <ol className="flex flex-wrap items-start justify-center gap-x-3 gap-y-3 sm:justify-start">
        {ranks.map((rank) => {
          const isCurrent = rank.id === currentRankId;
          const reached = currentLevel >= rank.minLevel;
          const IconComponent =
            LUCIDE_ICON_MAP[rank.icon] ?? LUCIDE_ICON_MAP.Trophy;
          return (
            <li
              key={rank.id}
              className="flex w-16 shrink-0 flex-col items-center gap-1 text-center"
              title={t("rankMinLevel", { level: rank.minLevel })}
            >
              <span
                className={cn(
                  "flex size-11 items-center justify-center rounded-full transition-all",
                  reached
                    ? cn(
                        "shadow-md",
                        blockBorderClass(rank.color),
                        solidTextOnColor[rank.color],
                        isCurrent &&
                          "ring-primary ring-offset-card ring-2 ring-offset-2",
                      )
                    : "text-muted-foreground border-border/60 bg-muted/40 grayscale",
                )}
              >
                <IconComponent className="size-5" />
              </span>
              <span
                className={cn(
                  "text-[10px] font-semibold uppercase leading-tight tracking-wide",
                  isCurrent
                    ? "text-foreground"
                    : reached
                      ? "text-muted-foreground"
                      : "text-muted-foreground/60",
                )}
              >
                {t(rank.nameKey)}
              </span>
              <span
                className={cn(
                  "font-jetbrainsMono text-[10px] tabular-nums",
                  isCurrent ? "text-primary font-bold" : "text-muted-foreground",
                )}
              >
                Nv {rank.minLevel}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function NextAchievementCallout({
  summary,
}: {
  summary: NonNullable<ReturnType<typeof useGamification>["summary"]>;
}) {
  const ta = useTranslations("app.gamification.achievements");

  // Conquista bloqueada com maior progresso (mais próxima de completar).
  const closest = [...summary.achievements]
    .filter((achievement) => achievement.unlockedAt === null)
    .sort((a, b) => b.progress - a.progress)[0];

  if (!closest) return null;

  return (
    <div className="border-primary/30 bg-primary/5 flex items-center gap-3 rounded-xl border p-3.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-card">
        <Target className="text-primary size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          {ta(`${closest.id}.name`)}
        </p>
        <p className="text-muted-foreground mb-1 truncate text-xs">
          {ta(`${closest.id}.description`)}
        </p>
        <div className="bg-muted h-1.5 w-full max-w-xs overflow-hidden rounded-full">
          <div
            className="bg-primary h-full rounded-full"
            style={{ width: `${closest.progress}%` }}
          />
        </div>
      </div>
      <span className="text-muted-foreground shrink-0 text-xs font-medium tabular-nums">
        {closest.progress}%
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Filtros, distribuição e recordes                                     */
/* ------------------------------------------------------------------ */

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

/** Card "Distribuição de XP": soma por origem com barras proporcionais. */
function BreakdownCard({
  breakdown,
}: {
  breakdown: NonNullable<
    ReturnType<typeof useGamification>["summary"]
  >["breakdown"];
}) {
  const t = useTranslations("app.gamification.breakdown");
  const tKinds = useTranslations("app.gamification.history.kinds");

  const entries = breakdown.filter((row) => row.amount !== 0);
  if (entries.length === 0) {
    return <EmptyBlock>{t("empty")}</EmptyBlock>;
  }

  const maxAbs = Math.max(...entries.map((entry) => Math.abs(entry.amount)));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {entries.map((entry) => {
          const positive = entry.amount >= 0;
          const width = Math.max(
            4,
            Math.round((Math.abs(entry.amount) / maxAbs) * 100),
          );
          return (
            <div key={entry.kind} className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-muted-foreground truncate">
                  {tKinds(xpKindLabelKey(entry.kind))}
                </span>
                <span
                  className={cn(
                    "font-mono font-semibold tabular-nums",
                    positive
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-destructive",
                  )}
                >
                  {positive ? `+${entry.amount}` : entry.amount}
                </span>
              </div>
              <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                <div
                  className={cn(
                    "h-full rounded-full",
                    positive
                      ? "bg-emerald-500 dark:bg-emerald-400"
                      : "bg-destructive/80",
                  )}
                  style={{ width: `${width}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

/** Recordes de consistência derivados do histórico real. */
function RecordsCard({
  currentRoutineStreak,
  bestRoutineStreak,
  currentCleanStreak,
  bestCleanStreak,
}: {
  currentRoutineStreak: number;
  bestRoutineStreak: number;
  currentCleanStreak: number;
  bestCleanStreak: number;
}) {
  const t = useTranslations("app.gamification.records");

  const records = [
    {
      icon: Flame,
      tone: "text-orange-600 dark:text-orange-400",
      label: t("routineStreak"),
      current: currentRoutineStreak,
      best: bestRoutineStreak,
    },
    {
      icon: Shield,
      tone: "text-sky-600 dark:text-sky-400",
      label: t("cleanStreak"),
      current: currentCleanStreak,
      best: bestCleanStreak,
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {records.map((record) => (
          <div key={record.label} className="flex items-center gap-3">
            <record.icon className={cn("size-5 shrink-0", record.tone)} />
            <p className="min-w-0 flex-1 truncate text-sm">{record.label}</p>
            <p className="shrink-0 text-sm tabular-nums">
              <span className="font-jetbrainsMono text-lg font-bold">
                {record.current}
              </span>
              <span className="text-muted-foreground mx-1.5 text-[11px] font-medium">
                {t("currentLabel")}
              </span>
              <span className="text-muted-foreground text-xs">
                · {t("bestLabel")} {record.best}
              </span>
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
