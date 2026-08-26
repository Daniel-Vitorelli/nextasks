"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { disablePush, enablePush, getPushState } from "@/lib/client/push";

interface Preferences {
  friendEvents: boolean;
  achievements: boolean;
  taskReminders: boolean;
  blockReminders: boolean;
  habitReminders: boolean;
}

const DEFAULT_PREFERENCES: Preferences = {
  friendEvents: true,
  achievements: true,
  taskReminders: true,
  blockReminders: true,
  habitReminders: true,
};

const PREFERENCE_KEYS = [
  "friendEvents",
  "achievements",
  "taskReminders",
  "blockReminders",
  "habitReminders",
] as const;

type PushState = "unsupported" | "insecure" | "denied" | "subscribed" | "unsubscribed";

export function NotificationsSection() {
  const t = useTranslations("app.config.notifications");
  const locale = useLocale();

  const [pushState, setPushState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testSent, setTestSent] = useState(false);
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);

  const refresh = useCallback(async () => {
    setPushState(await getPushState());
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void refresh();
  }, [refresh]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    let active = true;
    fetch("/api/push/preferences")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!active || !data) return;
        setPreferences({ ...DEFAULT_PREFERENCES, ...data });
        setPreferencesLoaded(true);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const updatePreference = async (key: keyof Preferences, value: boolean) => {
    const previous = preferences;
    setPreferences((current) => ({ ...current, [key]: value }));
    try {
      const response = await fetch("/api/push/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      if (!response.ok) throw new Error("Failed");
    } catch {
      setPreferences(previous);
    }
  };

  const handleEnable = async () => {
    setBusy(true);
    setTestSent(false);
    const result = await enablePush(locale);
    if (result === "subscribed") {
      setPushState("subscribed");
    } else if (result === "denied") {
      setPushState("denied");
    }
    setBusy(false);
  };

  const handleDisable = async () => {
    setBusy(true);
    await disablePush();
    await refresh();
    setBusy(false);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestSent(false);
    try {
      await fetch("/api/push/test", { method: "POST" });
      setTestSent(true);
    } catch {
      // silencioso: o botão de teste não precisa de tratamento elaborado
    }
    setTesting(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {pushState === null && <Spinner />}

        {(pushState === "unsupported" || pushState === "denied" || pushState === "insecure") && (
          <p className="text-sm text-muted-foreground">
            {pushState === "unsupported"
              ? t("unsupported")
              : pushState === "insecure"
                ? t("requiresHttps")
                : t("permissionDenied")}
          </p>
        )}

        {(pushState === "subscribed" || pushState === "unsubscribed") && (
          <div className="flex flex-wrap items-center gap-3">
            {pushState === "subscribed" ? (
              <>
                <span className="flex items-center gap-2 text-sm">
                  <span className="size-2 rounded-full bg-emerald-500" aria-hidden />
                  {t("statusActive")}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handleDisable()}
                  disabled={busy}
                >
                  {busy ? <Spinner /> : t("disable")}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => void handleTest()}
                  disabled={testing}
                >
                  {testing ? <Spinner /> : t("sendTest")}
                </Button>
              </>
            ) : (
              <>
                <span className="text-sm text-muted-foreground">{t("statusInactive")}</span>
                <Button type="button" size="sm" onClick={() => void handleEnable()} disabled={busy}>
                  {busy ? <Spinner /> : t("enable")}
                </Button>
              </>
            )}
            {testSent && <span className="text-sm text-muted-foreground">{t("testSent")}</span>}
          </div>
        )}

        <div className="flex flex-col gap-3 border-t pt-4">
          {PREFERENCE_KEYS.map((key) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <Label htmlFor={`pref-${key}`} className="text-sm font-normal">
                {t(`categories.${key}`)}
              </Label>
              <Switch
                id={`pref-${key}`}
                checked={preferences[key]}
                onCheckedChange={(checked) => void updatePreference(key, checked)}
                disabled={!preferencesLoaded}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
