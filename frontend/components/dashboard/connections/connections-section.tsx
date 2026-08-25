"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Link2,
  ListChecks,
  Settings2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ConnectionsManagerDialog } from "./connections-manager-dialog";
import { useConnections } from "@/components/connections/connections-provider";

function useConnectionsSummary() {
  const { data } = useConnections();
  const total = data?.connections.length ?? 0;
  const satisfied =
    data?.connections.filter(
      (connection) => connection.confirmedCount >= connection.requiredCount,
    ).length ?? 0;

  return {
    total,
    satisfied,
    pending: total - satisfied,
    entities: new Set(
      data?.connections.map((connection) =>
        connection.taskId ??
        connection.subtaskId ??
        connection.habitId ??
        "",
      ).filter((key) => key !== ""),
    ).size,
  };
}

export function ConnectionsSection() {
  const t = useTranslations("dashboard.connections");
  const { isLoading, data, reload } = useConnections();
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const summary = useConnectionsSummary();

  const handleOpenChange = (next: boolean) => {
    if (next) void reload();
    setIsDialogOpen(next);
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>

        <Button variant="outline" onClick={() => setIsDialogOpen(true)}>
          <Settings2 />
          {t("manage")}
        </Button>
      </div>

      <ConnectionsManagerDialog
        open={isDialogOpen}
        onOpenChange={handleOpenChange}
      />

      {isLoading && !data ? (
        <div className="flex items-center justify-center py-10">
          <Spinner className="size-6" />
        </div>
      ) : summary.total === 0 ? (
        <EmptyState onOpen={() => setIsDialogOpen(true)} />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            icon={<Link2 className="text-muted-foreground size-4" />}
            label={t("stats.total")}
            value={summary.total}
            footer={
              summary.total > 0 && (
                <div className="bg-muted flex h-1 w-full overflow-hidden rounded-full">
                  <div
                    className="bg-emerald-500 h-full dark:bg-emerald-400"
                    style={{
                      width: `${(summary.satisfied / summary.total) * 100}%`,
                    }}
                  />
                  <div
                    className="bg-amber-500 h-full"
                    style={{
                      width: `${(summary.pending / summary.total) * 100}%`,
                    }}
                  />
                </div>
              )
            }
          />
          <StatCard
            icon={
              <CheckCircle2 className="text-emerald-600 size-4 dark:text-emerald-400" />
            }
            label={t("stats.satisfied")}
            value={summary.satisfied}
          />
          <StatCard
            icon={
              <Clock className="text-amber-600 size-4 dark:text-amber-400" />
            }
            label={t("stats.pending")}
            value={summary.pending}
          />
          <StatCard
            icon={
              <ListChecks className="text-blue-600 size-4 dark:text-blue-400" />
            }
            label={t("stats.entities")}
            value={summary.entities}
          />
        </div>
      )}
    </section>
  );
}

function StatCard({
  icon,
  label,
  value,
  footer,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  footer?: React.ReactNode;
}) {
  return (
    <div className="border-border/60 bg-background flex items-center gap-3 rounded-xl border p-3">
      <div className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className="text-xl font-semibold leading-tight tabular-nums">
            {value}
          </p>
          <p className="text-muted-foreground truncate text-[11px] uppercase tracking-wide">
            {label}
          </p>
        </div>
        {footer}
      </div>
    </div>
  );
}

function EmptyState({ onOpen }: { onOpen: () => void }) {
  const t = useTranslations("dashboard.connections");

  return (
    <div className="border-border/60 flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed py-12 text-center">
      <div className="flex items-center gap-2">
        <span className="bg-event-blue-bg text-event-blue flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium">
          <ListChecks className="size-3.5" />
          {t("empty.flowTask")}
        </span>
        <ArrowRight className="text-muted-foreground size-4" />
        <span className="bg-event-purple-bg text-event-purple flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium">
          <Clock className="size-3.5" />
          {t("empty.flowBlock")}
        </span>
        <ArrowRight className="text-muted-foreground size-4" />
        <span className="bg-event-green-bg text-event-green flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium">
          <CheckCircle2 className="size-3.5" />
          {t("empty.flowDone")}
        </span>
      </div>
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{t("empty.title")}</p>
        <p className="text-muted-foreground text-sm">{t("empty.description")}</p>
      </div>
      <Button variant="outline" onClick={onOpen}>
        <Settings2 />
        {t("manage")}
      </Button>
    </div>
  );
}