"use client";

import { useTranslations } from "next-intl";

import { RoutinesSection } from "@/components/dashboard/routines/routines-section";
import { useSession } from "@/components/session-provider";

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const { user } = useSession() ?? {};

  const firstName = user?.name?.split(" ")[0];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-12 px-4 py-12 md:px-8">
      <header className="space-y-1.5">
        <p className="font-jetbrainsMono text-sm text-muted-foreground uppercase tracking-[0.2em]">
          {t("eyebrow")}
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {t("greeting", { name: firstName ?? t("fallbackName") })}
        </h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </header>

      <RoutinesSection />
    </main>
  );
}