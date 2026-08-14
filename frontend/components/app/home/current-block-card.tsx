"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Clock, SquareCheck, Gauge } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { eventColorStyles } from "@/components/calendar/calendar-event-color";
import type { TimeBlock } from "@/types/domain";

interface CurrentBlockCardProps {
  block: TimeBlock;
  routineName: string;
  timeFormatter: Intl.DateTimeFormat;
  tzOffsetMinutes: number;
  onConfirmed: (blockId: string) => void;
}

export function CurrentBlockCard({
  block,
  routineName,
  timeFormatter,
  tzOffsetMinutes,
  onConfirmed,
}: CurrentBlockCardProps) {
  const t = useTranslations("app.home");
  const colorStyles = eventColorStyles[block.color];

  const [checked, setChecked] = useState(true);
  const [score, setScore] = useState(5);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    const value =
      block.confirmation === "score" ? String(score) : checked ? "true" : "false";

    setIsSubmitting(true);
    try {
      const response = await fetch(
        `/api/time-blocks/${block.id}/complete?tzOffset=${tzOffsetMinutes}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to save confirmation");
      }

      onConfirmed(block.id);
    } catch (error) {
      console.error(error);
      setIsSubmitting(false);
    }
  };

  return (
    <li
      className={cn(
        "flex flex-col gap-4 rounded-xl border border-border/60 bg-card p-5 transition-colors",
        colorStyles?.borderHover,
      )}
    >
      <div className="flex items-center gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="truncate text-xl font-semibold tracking-tight">
            {block.title}
          </h2>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="size-4" />
            {block.isAllDay
              ? t("currentBlock.allDay")
              : `${timeFormatter.format(new Date(block.start))} – ${timeFormatter.format(new Date(block.end))}`}
          </div>
          {block.description && (
            <p className="mt-1 text-sm text-muted-foreground">
              {block.description}
            </p>
          )}
        </div>

        <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-2.5 py-0.5 text-xs capitalize">
          {routineName}
        </span>
      </div>

      {block.confirmation === "checklist" && (
        <div className="flex items-center justify-between gap-4 border-t pt-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Switch
              size="sm"
              checked={checked}
              onCheckedChange={setChecked}
              className={colorStyles?.checkedBg}
            />
            <span className="text-muted-foreground">
              {t("currentBlock.checklistLabel")}
            </span>
          </label>
          <Button
            size="sm"
            onClick={() => void handleConfirm()}
            disabled={isSubmitting}
            className={cn(colorStyles?.accentBg, colorStyles?.accentBgHover)}
          >
            {isSubmitting ? <Spinner /> : <SquareCheck />}
            <span className="hidden sm:inline">{t("currentBlock.confirm")}</span>
          </Button>
        </div>
      )}

      {block.confirmation === "score" && (
        <div className="flex flex-col gap-3 border-t pt-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-2 text-sm">
              <Gauge className="size-4" />
              {t("currentBlock.scoreLabel")}
            </span>
            <span className="bg-muted text-foreground rounded-full px-2.5 py-0.5 text-sm font-medium">
              {t("currentBlock.scoreValue", { value: score })}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Slider
              min={1}
              max={10}
              step={1}
              value={[score]}
              onValueChange={([value]) => setScore(value)}
              disabled={isSubmitting}
              className="flex-1"
              rangeClassName={colorStyles?.accentBg}
              thumbClassName={colorStyles?.accentBorder}
            />
            <Button
              size="sm"
              onClick={() => void handleConfirm()}
              disabled={isSubmitting}
              className={cn(colorStyles?.accentBg, colorStyles?.accentBgHover)}
            >
              {isSubmitting ? <Spinner /> : t("currentBlock.confirm")}
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
