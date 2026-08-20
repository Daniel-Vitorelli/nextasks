"use client";

import { useTranslations } from "next-intl";
import { Flame, Medal, Trophy } from "lucide-react";

import type { StreakStats } from "@/types/domain";

interface StreakCardProps {
  streak: StreakStats;
  locale: string;
}

export function StreakCard({ streak, locale }: StreakCardProps) {
  const t = useTranslations("app.home.streak");

  const lastFullDay = streak.lastFullDay
    ? new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      }).format(new Date(streak.lastFullDay))
    : t("none");

  const stats = [
    {
      icon: <Flame className="size-5 text-orange-500" />,
      label: t("current"),
      value: t("daysLabel", { count: streak.current }),
      highlight: true,
    },
    {
      icon: <Trophy className="size-5 text-amber-500" />,
      label: t("longest"),
      value: t("daysLabel", { count: streak.longest }),
    },
    {
      icon: <Medal className="size-5 text-sky-500" />,
      label: t("lastFullDay"),
      value: lastFullDay,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-border/60 bg-border/60 sm:grid-cols-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="flex items-center gap-3 bg-card p-4"
        >
          {stat.icon}
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p
              className={
                stat.highlight
                  ? "font-jetbrainsMono text-2xl font-bold text-orange-500"
                  : "truncate text-lg font-semibold tabular-nums"
              }
            >
              {stat.value}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}