"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronRight, Link2, Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { ConnectionPopover } from "@/components/connections/connection-popover";
import { ConnectionBadge } from "@/components/connections/connection-badge";
import { cn } from "@/lib/utils";
import type { Subtask } from "@/types/domain";

export interface SubtaskNodeProps {
  subtask: Subtask;
  depth: number;
  onAddChild: (parent: Subtask) => void;
  onEdit: (subtask: Subtask) => void;
  onDelete: (subtask: Subtask) => void;
  onToggleDone: (subtask: Subtask, done: boolean) => void;
}

export function SubtaskNode({
  subtask,
  depth,
  onAddChild,
  onEdit,
  onDelete,
  onToggleDone,
}: SubtaskNodeProps) {
  const t = useTranslations("dashboard.tasks.subtasks");
  const [expanded, setExpanded] = useState(true);
  const hasChildren = subtask.children.length > 0;

  return (
    <li>
      {/* Contêiner indentado: linha-guia vertical na borda esquerda (depth * 24px) percorrendo linha + sub-árvore. */}
      <div className="relative pl-6">
        {depth > 0 && (
          <span
            aria-hidden
            className="bg-border/70 absolute bottom-0 left-0 top-0 w-px"
          />
        )}

        {depth > 0 && (
          <span
            aria-hidden
            className="bg-border/70 absolute left-0 top-4 h-px w-6 -translate-y-1/2"
          />
        )}

        <div className="group/row flex items-start gap-1.5 rounded-md py-1.5 pr-1.5 transition-colors hover:bg-muted/50">
          <Checkbox
            checked={subtask.done}
            onCheckedChange={(checked) =>
              onToggleDone(subtask, checked === true)
            }
            aria-label={
              subtask.done ? t("toggleDone.undo") : t("toggleDone.do")
            }
            className="mt-0.5 shrink-0"
          />

          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            disabled={!hasChildren}
            aria-expanded={hasChildren ? expanded : undefined}
            aria-label={hasChildren ? t("collapseExpand") : undefined}
            className="text-muted-foreground mt-px flex size-4 shrink-0 items-center justify-center disabled:invisible"
          >
            {hasChildren && (expanded ? <ChevronDown /> : <ChevronRight />)}
          </button>

          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "truncate text-sm font-medium",
                subtask.done && "text-muted-foreground line-through",
              )}
            >
              {subtask.title}
            </p>
            {subtask.description && (
              <p className="text-muted-foreground line-clamp-2 text-xs">
                {subtask.description}
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/row:opacity-100">
            <ConnectionPopover
              anchor={{ type: "subtask", id: subtask.id, title: subtask.title }}
            >
              <Button
                size="icon-xs"
                variant="ghost"
                aria-label={t("connect")}
              >
                <span className="relative">
                  <Link2 />
                  <ConnectionBadge
                    anchor={{ type: "subtask", id: subtask.id }}
                    className="absolute -right-2 -top-2"
                  />
                </span>
              </Button>
            </ConnectionPopover>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  onClick={() => onAddChild(subtask)}
                  aria-label={t("addChild")}
                >
                  <Plus />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t("addChild")}</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  onClick={() => onEdit(subtask)}
                  aria-label={t("edit")}
                >
                  <Pencil />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t("edit")}</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  onClick={() => onDelete(subtask)}
                  aria-label={t("delete")}
                >
                  <Trash2 className="text-destructive" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t("delete")}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {hasChildren && expanded && (
          <ul>
            {subtask.children.map((child) => (
              <SubtaskNode
                key={child.id}
                subtask={child}
                depth={depth + 1}
                onAddChild={onAddChild}
                onEdit={onEdit}
                onDelete={onDelete}
                onToggleDone={onToggleDone}
              />
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}