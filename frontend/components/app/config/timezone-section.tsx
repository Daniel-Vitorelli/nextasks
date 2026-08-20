"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useSession } from "@/components/app/session-provider";

/** Opções de fuso: "auto" (navegador) + UTC-12 a UTC+14 em horas cheias. */
const TZ_OPTIONS = Array.from({ length: 27 }, (_, index) => (index - 12) * 60);

function timezoneLabel(offsetMinutes: number): string {
  const hours = -offsetMinutes / 60;
  const sign = hours >= 0 ? "+" : "\u2212";
  return `UTC${sign}${Math.abs(hours)}`;
}

export function TimezoneSection() {
  const t = useTranslations("app.config.timezone");
  const { user, refetchUser } = useSession() ?? {};

  // O perfil completo chega assíncrono (via /api/user): o valor exibido deriva
  // sempre do usuário atual, com um "draft" apenas enquanto se edita.
  const currentValue =
    user?.timezoneOffset === null || user?.timezoneOffset === undefined
      ? "auto"
      : String(user.timezoneOffset);
  const [draft, setDraft] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );

  const browserLabel = useMemo(
    () => timezoneLabel(new Date().getTimezoneOffset()),
    [],
  );

  const save = async (value: string) => {
    setStatus("saving");
    try {
      const response = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timezoneOffset: value === "auto" ? null : Number(value),
        }),
      });
      if (!response.ok) throw new Error("Failed to update timezone");
      await refetchUser?.();
      setDraft(null);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor="timezone-select">{t("selectLabel")}</Label>
          <Select
            value={draft ?? currentValue}
            onValueChange={(value) => {
              setDraft(value);
              if (status !== "idle") setStatus("idle");
            }}
          >
            <SelectTrigger id="timezone-select" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">
                {t("auto", { offset: browserLabel })}
              </SelectItem>
              {TZ_OPTIONS.map((offset) => (
                <SelectItem key={offset} value={String(offset)}>
                  {timezoneLabel(offset)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          onClick={() => void save(draft ?? currentValue)}
          disabled={status === "saving" || draft === null}
        >
          {status === "saving" ? <Spinner /> : t("save")}
        </Button>
      </CardContent>
      {status === "saved" && (
        <CardContent className="pt-0 text-sm text-muted-foreground">
          {t("saved")}
        </CardContent>
      )}
      {status === "error" && (
        <CardContent className="pt-0 text-sm text-destructive">
          {t("saveError")}
        </CardContent>
      )}
    </Card>
  );
}