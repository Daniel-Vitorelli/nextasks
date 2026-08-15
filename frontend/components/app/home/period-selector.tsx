"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PERIODS = [7, 15, 30, 60] as const;

interface PeriodSelectorProps {
  value: number;
  onChange: (days: number) => void;
  className?: string;
}

export function PeriodSelector({
  value,
  onChange,
  className,
}: PeriodSelectorProps) {
  const t = useTranslations("app.home.progressChart");

  return (
    <div
      className={cn("flex items-center gap-1.5", className)}
      role="group"
      aria-label={t("periodLabel")}
    >
      {PERIODS.map((days) => (
        <Button
          key={days}
          size="sm"
          variant={value === days ? "default" : "outline"}
          onClick={() => onChange(days)}
          aria-pressed={value === days}
        >
          {t(`period.${days}d`)}
        </Button>
      ))}
    </div>
  );
}
