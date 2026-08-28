"use client";

import { Check, X, Clock, Sparkles, Target, Calendar, Link2, ListTodo, Pencil, Trash2, Power, ListTree, RotateCcw, CalendarCheck, CalendarX, Link, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import type { AiProposalView } from "@/hooks/use-ai-chat";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const KIND_ICON: Record<string, React.ElementType> = {
  create_task: ListTodo,
  update_task: Pencil,
  complete_task: Check,
  delete_task: Trash2,
  create_subtask: ListTree,
  update_subtask: Pencil,
  delete_subtask: Trash2,
  complete_subtask: Check,
  create_habit: Target,
  update_habit: Pencil,
  delete_habit: Trash2,
  complete_habit: Check,
  undo_habit: RotateCcw,
  create_routine: Calendar,
  update_routine: Pencil,
  delete_routine: Trash2,
  activate_routine: Power,
  create_time_block: CalendarCheck,
  update_time_block: Pencil,
  delete_time_block: CalendarX,
  complete_time_block: Check,
  create_connection: Link,
  update_connection: Link2,
  delete_connection: Unlink,
  default: Sparkles,
};

const KIND_COLOR: Record<string, string> = {
  create_task: "text-blue-500",
  update_task: "text-blue-400",
  complete_task: "text-green-600",
  delete_task: "text-red-500",
  create_subtask: "text-sky-500",
  update_subtask: "text-sky-400",
  delete_subtask: "text-red-400",
  complete_subtask: "text-emerald-600",
  create_habit: "text-purple-500",
  update_habit: "text-purple-400",
  delete_habit: "text-red-400",
  complete_habit: "text-emerald-500",
  undo_habit: "text-amber-600",
  create_routine: "text-orange-500",
  update_routine: "text-orange-400",
  delete_routine: "text-red-500",
  activate_routine: "text-green-600",
  create_time_block: "text-cyan-600",
  update_time_block: "text-cyan-500",
  delete_time_block: "text-red-400",
  complete_time_block: "text-green-600",
  create_connection: "text-amber-600",
  update_connection: "text-amber-500",
  delete_connection: "text-red-400",
};

function formatKind(kind: string, t: ReturnType<typeof useTranslations>) {
  // tenta tradução, fallback para kind
  try {
    return t(`proposal.kinds.${kind}` as never);
  } catch {
    return kind.replaceAll("_", " ");
  }
}

export function ProposalCard({
  proposal,
  onAccept,
  onReject,
  disabled,
}: {
  proposal: AiProposalView;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("app.ai");
  const status = proposal.status;
  const isPending = status === "pending";

  return (
    <Card className={cn("my-2 w-full max-w-[85%] overflow-hidden rounded-2xl border py-0", isPending ? "border-primary/40 bg-primary/5" : "opacity-90")}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
        <div className="flex items-center gap-2 text-xs font-medium">
          <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Sparkles className="size-3.5" />
          </span>
          <span>{t("proposal.previewTitle")}</span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] uppercase font-medium",
              isPending ? "bg-primary text-primary-foreground" : status === "accepted" ? "bg-muted text-muted-foreground" : "border border-border text-muted-foreground",
            )}
          >
            {status === "pending" ? t("proposal.status.pending") : status === "accepted" ? t("proposal.status.accepted") : status === "rejected" ? t("proposal.status.rejected") : t("proposal.status.expired")}
          </span>
        </div>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Clock className="size-3" />
          {new Date(proposal.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </CardHeader>
      <div className="space-y-3 p-3 pt-0">
        <p className="text-xs text-muted-foreground">
          {isPending ? t("proposal.pendingHint") : status === "accepted" ? t("proposal.acceptedHint") : t("proposal.rejectedHint")}
        </p>
        <ul className="space-y-2">
          {proposal.actions.map((action) => {
            const Icon = KIND_ICON[action.kind] ?? KIND_ICON.default;
            const color = KIND_COLOR[action.kind] ?? "text-primary";
            const timeBlocks = (action.params as Record<string, unknown>).timeBlocks as
              | { title: string; start: string; end: string; isAllDay?: boolean; color?: string }[]
              | undefined;
            return (
              <li
                key={action.id}
                className="flex gap-2 rounded-xl border border-border/50 bg-card p-2.5 text-sm"
              >
                <span className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted", color)}>
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-tight">{action.previewTitle}</p>
                  <p className="break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">{action.previewDescription}</p>
                  {timeBlocks && timeBlocks.length > 0 && (
                    <ul className="mt-1.5 space-y-1 rounded-lg bg-muted/50 p-2">
                      {timeBlocks.slice(0, 5).map((b, i) => {
                        const s = b.start ? new Date(b.start as string) : null;
                        const e = b.end ? new Date(b.end as string) : null;
                        const time = s && e && !b.isAllDay ? `${String(s.getUTCHours()).padStart(2, "0")}:${String(s.getUTCMinutes()).padStart(2, "0")}-${String(e.getUTCHours()).padStart(2, "0")}:${String(e.getUTCMinutes()).padStart(2, "0")}` : b.isAllDay ? "dia todo" : "";
                        return (
                          <li key={i} className="flex items-center gap-1.5 text-xs">
                            <span className="size-1.5 rounded-full bg-primary shrink-0" />
                            <span className="font-medium">{b.title}</span>
                            <span className="text-muted-foreground">{time}</span>
                            {b.color && <span className="ml-auto size-2 rounded-full" style={{ backgroundColor: b.color as string }} />}
                          </li>
                        );
                      })}
                      {timeBlocks.length > 5 && <li className="text-[11px] text-muted-foreground">+{timeBlocks.length - 5} mais</li>}
                    </ul>
                  )}
                  <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground/70">{formatKind(action.kind, t)}</p>
                  {action.warnings && action.warnings.length > 0 && (
                    <p className="text-[11px] text-amber-600">{action.warnings.join(" • ")}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        {isPending && (
          <div className="flex justify-end gap-2 pt-1">
            <Button size="sm" variant="outline" disabled={disabled} onClick={() => onReject(proposal.id)}>
              <X className="size-3.5" />
              {t("proposal.reject")}
            </Button>
            <Button size="sm" disabled={disabled} onClick={() => onAccept(proposal.id)}>
              <Check className="size-3.5" />
              {t("proposal.accept")}
            </Button>
          </div>
        )}
        {!isPending && (
          <div className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
            {status === "accepted" ? <Check className="size-3.5 text-green-600" /> : <X className="size-3.5" />}
            {status === "accepted" ? t("proposal.applied") : t("proposal.dismissed")}
          </div>
        )}
      </div>
    </Card>
  );
}
