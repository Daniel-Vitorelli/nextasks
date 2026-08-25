"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Crown, Sparkles, TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";
import { useGamification } from "@/hooks/use-gamification";

type FlashKind = "achievement" | "level" | "xp";

interface Flash {
  kind: FlashKind;
  /** XP delta (apenas para kind="xp"). */
  delta?: number;
  achievementId?: string;
  level?: number;
  key: number;
}

/**
 * Pílula flutuante com fila sequencial: eventos rápidos em rajada tocam um
 * após o outro em vez de se sobrescreverem. Prioridade de detecção:
 * conquista desbloqueada > subida de nível > delta de XP.
 */
export function XpToast() {
  const t = useTranslations("app.gamification");
  const { summary } = useGamification();

  const previous = React.useRef<{
    totalXp: number;
    unlockedCount: number;
    level: number;
  } | null>(null);
  const [queue, setQueue] = React.useState<Flash[]>([]);

  const enqueue = React.useCallback((flash: Omit<Flash, "key">) => {
    setQueue((existing) => [...existing.slice(-4), { ...flash, key: Date.now() }]);
  }, []);

  React.useEffect(() => {
    if (!summary) return;
    const snapshot = {
      totalXp: summary.totalXp,
      unlockedCount: summary.unlockedCount,
      level: summary.level,
    };
    const prev = previous.current;
    previous.current = snapshot;
    if (!prev) return;

    // Conquista nova? (uma por evento; múltiplas entram na fila)
    if (summary.unlockedCount > prev.unlockedCount) {
      const latest = [...summary.achievements]
        .filter((a) => a.unlockedAt !== null)
        .sort((a, b) =>
          (b.unlockedAt ?? "").localeCompare(a.unlockedAt ?? ""),
        )[0];
      enqueue({
        kind: "achievement",
        achievementId: latest?.id,
      });
      return;
    }

    // Subiu de nível?
    if (summary.level > prev.level) {
      enqueue({ kind: "level", level: summary.level });
      return;
    }

    // Delta de XP comum.
    const delta = summary.totalXp - prev.totalXp;
    if (delta === 0 || Math.abs(delta) > 1000) return;
    enqueue({ kind: "xp", delta });
  }, [summary, enqueue]);

  // O flash exibido é sempre a cabeça da fila.
  const current = queue[0] ?? null;

  // Consome a cabeça após 2s; a próxima entra automaticamente.
  React.useEffect(() => {
    if (queue.length === 0) return;
    const timer = setTimeout(() => {
      setQueue((existing) => existing.slice(1));
    }, 2000);
    return () => clearTimeout(timer);
  }, [queue]);

  const ta = useTranslations("app.gamification.achievements");

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-24 left-1/2 z-50 -translate-x-1/2"
    >
      <div
        key={current?.key ?? "idle"}
        className={cn(
          "flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold shadow-lg transition-all duration-300",
          current ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
          toneFor(current),
        )}
      >
        {!current ? (
          <span className="inline-block">&nbsp;</span>
        ) : current.kind === "achievement" ? (
          <>
            <Sparkles className="size-4" />
            {current.achievementId
              ? ta(`${current.achievementId}.name`)
              : t("unlockedLabel")}
          </>
        ) : current.kind === "level" ? (
          <>
            <Crown className="size-4" />
            {t("levelUp", { level: current.level ?? 0 })}
          </>
        ) : (
          <>
            <TrendingUp className="size-4" />
            {(current.delta ?? 0) >= 0
              ? t("xpGained", { amount: current.delta ?? 0 })
              : t("xpLost", { amount: Math.abs(current.delta ?? 0) })}
          </>
        )}
      </div>
    </div>
  );
}

function toneFor(flash: Flash | null): string {
  if (!flash) return "";
  if (flash.kind === "achievement") {
    return "border-yellow-500/40 bg-yellow-500/15 text-yellow-700 dark:text-yellow-300";
  }
  if (flash.kind === "level") {
    return "border-purple-500/40 bg-purple-500/15 text-purple-700 dark:text-purple-300";
  }
  return (flash.delta ?? 0) >= 0
    ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
    : "border-destructive/30 bg-destructive/10 text-destructive";
}
