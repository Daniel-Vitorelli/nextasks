"use client";

import { useTranslations } from "next-intl";

import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function AppearanceSection() {
  const t = useTranslations("app.config.appearance");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center gap-4">
        <AnimatedThemeToggler
          aria-label={t("toggleLabel")}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-input"
        />
      </CardContent>
    </Card>
  );
}