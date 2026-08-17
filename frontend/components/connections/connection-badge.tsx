"use client";

import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { useConnections } from "./connections-provider";

export type ConnectionBadgeAnchor = {
  type: "task" | "subtask" | "block";
  id: string;
};

/**
 * Badge com o número de conexões da entidade/bloco e estado de satisfação:
 * verde quando todas as conexões estão satisfeitas (confirmedCount >=
 * requiredCount). Não renderiza nada quando não há conexões.
 */
export function ConnectionBadge({
  anchor,
  className,
}: {
  anchor: ConnectionBadgeAnchor;
  className?: string;
}) {
  const t = useTranslations("dashboard.tasks.connections");
  const { data } = useConnections();

  if (!data) return null;

  const connections = data.connections.filter((connection) =>
    anchor.type === "task"
      ? connection.taskId === anchor.id
      : anchor.type === "subtask"
        ? connection.subtaskId === anchor.id
        : connection.timeBlockId === anchor.id,
  );
  if (connections.length === 0) return null;

  const allSatisfied = connections.every(
    (connection) =>
      connection.confirmedCount >= connection.requiredCount,
  );

  return (
    <span
      title={t("badgeTitle", { count: connections.length })}
      className={cn(
        "flex size-4 items-center justify-center rounded-full text-[10px] font-bold leading-none text-white",
        allSatisfied ? "bg-emerald-500" : "bg-muted-foreground/30",
        className,
      )}
    >
      {connections.length}
      <span className="sr-only">
        {t("badgeTitle", { count: connections.length })}
      </span>
    </span>
  );
}