"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PERIODS = [7, 15, 30, 60] as const;

interface PeriodSelectorProps {
  value: number;
  onChange: (days: number) => void;
  /** Limita as opções aos períodos ≤ o número de dias registrados. */
  maxDays?: number;
  className?: string;
}

export function PeriodSelector({
  value,
  onChange,
  maxDays,
  className,
}: PeriodSelectorProps) {
  const t = useTranslations("app.home.progressChart");

  const availablePeriods =
    maxDays === undefined
      ? PERIODS
      : PERIODS.filter((days) => days <= maxDays);

  if (availablePeriods.length === 0) {
    return null;
  }

  return (
    <div
      className={cn("flex items-center gap-1.5", className)}
      role="group"
      aria-label={t("periodLabel")}
    >
      {availablePeriods.map((days) => (
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
