"use client";

import { useTranslations } from "next-intl";

import { AppearanceSection } from "@/components/app/config/appearance-section";
import { DataSection } from "@/components/app/config/data-section";
import { LocaleSwitcher } from "@/components/app/config/locale-switcher";
import { ProfileSection } from "@/components/app/config/profile-section";
import { TimezoneSection } from "@/components/app/config/timezone-section";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ConfigPage() {
  const t = useTranslations("app.config");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-12 px-4 py-12 md:px-8">
      <header className="space-y-1.5">
        <p className="font-jetbrainsMono text-sm text-muted-foreground uppercase tracking-[0.2em]">
          {t("eyebrow")}
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {t("title")}
        </h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </header>

      <div className="flex flex-col gap-8">
        <ProfileSection />

        <div className="grid gap-8 md:grid-cols-2">
          <AppearanceSection />
          <Card>
            <CardHeader>
              <CardTitle>{t("language.title")}</CardTitle>
              <CardDescription>{t("language.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <LocaleSwitcher />
            </CardContent>
          </Card>
        </div>

        <TimezoneSection />

        <DataSection />
      </div>
    </main>
  );
}