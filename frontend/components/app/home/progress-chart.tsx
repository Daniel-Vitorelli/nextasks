"use client";

import { useTranslations } from "next-intl";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import type { DailyProgress } from "@/types/domain";

interface ProgressChartProps {
  data: DailyProgress[];
  locale: string;
  className?: string;
}

const chartConfig = {
  value: {
    label: "Progress",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

export function ProgressChart({
  data,
  locale,
  className,
}: ProgressChartProps) {
  const t = useTranslations("app.home.progressChart");

  const dateFormatter = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
  });

  const tooltipDateFormatter = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  const chartData = data.map((item) => ({
    ...item,
    label: dateFormatter.format(new Date(item.date)),
    tooltipLabel: tooltipDateFormatter.format(new Date(item.date)),
  }));

  return (
    <ChartContainer
      config={chartConfig}
      className={cn("h-64 w-full", className)}
    >
      <AreaChart
        data={chartData}
        margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="fillProgress" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-value)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--color-value)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
        />
        <YAxis
          domain={[0, 100]}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value) => `${value}%`}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) => {
                const datum = payload?.[0]?.payload as
                  | (typeof chartData)[number]
                  | undefined;
                return datum?.tooltipLabel ?? "";
              }}
              formatter={(value) => (
                <div className="flex w-full items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 shrink-0 rounded-[2px] bg-(--color-value)" />
                    <span className="text-muted-foreground">
                      {t("progress")}
                    </span>
                  </div>
                  <span className="font-mono font-medium tabular-nums">
                    {value == null ? t("noData") : `${value}%`}
                  </span>
                </div>
              )}
            />
          }
        />
        <Area
          dataKey="value"
          type="monotone"
          fill="url(#fillProgress)"
          stroke="var(--color-value)"
          strokeWidth={2}
          connectNulls={false}
        />
      </AreaChart>
    </ChartContainer>
  );
}
