"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Swords, Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import {
  challengeMeta,
  type ChallengeMetricLabel,
} from "@/lib/notifications/templates";
import {
  type UseChallengesReturn,
} from "@/hooks/use-challenges";
import { useDataSync } from "@/lib/client/data-events";
import type {
  ChallengeParticipant,
  ChallengeView,
} from "@/types/domain";

const METRICS: ChallengeMetricLabel[] = ["xp", "blocks", "tasks", "habits"];
const DURATIONS = [3, 7, 14];

const TARGET_PRESETS: Record<ChallengeMetricLabel, number[]> = {
  xp: [500, 1000, 2500],
  blocks: [5, 15, 30],
  tasks: [5, 15, 30],
  habits: [10, 25, 60],
};

function Avatar({ user }: { user: ChallengeParticipant }) {
  return (
    <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted text-xs font-semibold text-muted-foreground">
      {user.image ? (
        <Image
          alt={user.name}
          className="size-full object-cover"
          height={40}
          src={user.image}
          unoptimized
          width={40}
        />
      ) : (
        "?"
      )}
    </div>
  );
}

export function ChallengesTab({
  myUserId,
  api,
}: {
  myUserId: string;
  /** Instância do hook vivendo na página (para o badge da aba). */
  api: UseChallengesReturn;
}) {
  const t = useTranslations("app.social.challenges");
  const locale = useLocale();
  const { data, isLoading, proposeChallenge, respondToChallenge, cancelChallenge, reload } =
    api;

  // Recarrega quando eventos de amizade/desafio chegam (SSE ou mesma aba).
  useDataSync(["friends"], reload);

  const [proposeOpen, setProposeOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const metaText = (challenge: Pick<ChallengeView, "metric" | "target" | "durationDays">) =>
    challengeMeta(
      locale === "pt" ? "pt" : "en",
      challenge.metric,
      challenge.target,
      challenge.durationDays,
    );

  const respond = async (challengeId: string, action: "accept" | "decline") => {
    setError(null);
    try {
      await respondToChallenge(challengeId, action);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("errorGeneric"));
    }
  };

  const hasAny =
    data.incoming.length > 0 ||
    data.active.length > 0 ||
    data.outgoing.length > 0 ||
    data.history.length > 0;

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <Button type="button" size="sm" onClick={() => setProposeOpen(true)}>
          <Swords className="size-4" />
          {t("propose")}
        </Button>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      {isLoading ? (
        <div className="flex items-center justify-center rounded-xl border border-border/60 bg-card py-16">
          <Spinner className="size-6" />
        </div>
      ) : !hasAny ? (
        <p className="text-muted-foreground rounded-xl border border-dashed border-border/60 py-12 text-center text-sm">
          {t("empty")}
        </p>
      ) : (
        <>
          {/* Recebidos */}
          {data.incoming.length > 0 && (
            <ChallengeGroup label={t("sections.incoming")}>
              {data.incoming.map((challenge) => (
                <Card key={challenge.id}>
                  <CardContent className="flex flex-wrap items-center gap-3 p-4">
                    <Avatar user={challenge.challenger} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{challenge.challenger.name}</p>
                      <p className="text-muted-foreground text-xs">{metaText(challenge)}</p>
                    </div>
                    <Button size="sm" onClick={() => void respond(challenge.id, "accept")}>
                      {t("accept")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void respond(challenge.id, "decline")}
                    >
                      {t("decline")}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </ChallengeGroup>
          )}

          {/* Em andamento */}
          {data.active.length > 0 && (
            <ChallengeGroup label={t("sections.active")}>
              {data.active.map((challenge) => (
                <ActiveChallengeCard key={challenge.id} challenge={challenge} myUserId={myUserId} />
              ))}
            </ChallengeGroup>
          )}

          {/* Enviados aguardando */}
          {data.outgoing.length > 0 && (
            <ChallengeGroup label={t("sections.outgoing")}>
              {data.outgoing.map((challenge) => (
                <Card key={challenge.id}>
                  <CardContent className="flex items-center gap-3 p-4">
                    <Avatar user={challenge.challenged} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{challenge.challenged.name}</p>
                      <p className="text-muted-foreground text-xs">{metaText(challenge)}</p>
                    </div>
                    <span className="text-muted-foreground text-[11px]">
                      {t("waitingReply")}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void cancelChallenge(challenge.id)}
                    >
                      {t("cancel")}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </ChallengeGroup>
          )}

          {/* Histórico */}
          {data.history.length > 0 && (
            <ChallengeGroup label={t("sections.history")}>
              {data.history.map((challenge) => (
                <FinishedChallengeCard
                  key={challenge.id}
                  challenge={challenge}
                  myUserId={myUserId}
                />
              ))}
            </ChallengeGroup>
          )}
        </>
      )}

      {/* Diálogo de proposta */}
      <ProposeDialog
        open={proposeOpen}
        onOpenChange={(open) => {
          setProposeOpen(open);
          if (!open) setError(null);
        }}
        onPropose={async (input) => {
          try {
            await proposeChallenge(input);
            setProposeOpen(false);
            return null;
          } catch (cause) {
            const raw = cause instanceof Error ? cause.message : "";
            if (raw.includes("already an open challenge")) return t("errorOpen");
            return t("errorGeneric");
          }
        }}
      />
    </section>
  );
}

/* ------------------------------ Sub-componentes ----------------------------- */

function ChallengeGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
        {label}
      </h3>
      {children}
    </div>
  );
}

function ProgressBar({ value, target }: { value: number; target: number }) {
  const percent = Math.min(100, Math.round((value / Math.max(1, target)) * 100));
  return (
    <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
      <div
        className={cn(
          "h-full rounded-full transition-all",
          percent >= 100 ? "bg-emerald-500" : "bg-primary",
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

function ActiveChallengeCard({
  challenge,
  myUserId,
}: {
  challenge: ChallengeView;
  myUserId: string;
}) {
  const t = useTranslations("app.social.challenges");
  const progress = challenge.progress ?? { challengerValue: 0, challengedValue: 0 };

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">
            {challenge.challenger.name} <span className="text-muted-foreground">× {challenge.challenged.name}</span>
          </p>
          <span className="text-muted-foreground shrink-0 text-xs">
            {t("daysLeft", { count: challenge.daysLeft ?? 0 })}
          </span>
        </div>

        {[challenge.challenger, challenge.challenged].map((participant) => {
          const value =
            participant.userId === challenge.challenger.userId
              ? progress.challengerValue
              : progress.challengedValue;
          return (
            <div key={participant.userId} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="truncate font-medium">
                  {participant.name}
                  {participant.userId === myUserId && ` (${t("you")})`}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {value.toLocaleString()} / {challenge.target.toLocaleString()}
                </span>
              </div>
              <ProgressBar value={value} target={challenge.target} />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function FinishedChallengeCard({
  challenge,
  myUserId,
}: {
  challenge: ChallengeView;
  myUserId: string;
}) {
  const t = useTranslations("app.social.challenges");

  let outcome: "won" | "lost" | "draw";
  if (challenge.winnerId === null) outcome = "draw";
  else outcome = challenge.winnerId === myUserId ? "won" : "lost";

  const winnerName =
    challenge.winnerId === challenge.challenger.userId
      ? challenge.challenger.name
      : challenge.challenged.name;

  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <Trophy
          className={cn(
            "size-5 shrink-0",
            outcome === "won" && "text-yellow-500",
            outcome === "lost" && "text-muted-foreground/50",
            outcome === "draw" && "text-muted-foreground",
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm">
            {challenge.challenger.name} × {challenge.challenged.name}
          </p>
          <p className="text-muted-foreground truncate text-xs">
            {outcome === "draw" ? t("draw") : t("winnerWas", { name: winnerName })}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold",
            outcome === "won" && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
            outcome === "lost" && "bg-destructive/10 text-destructive",
            outcome === "draw" && "bg-muted text-muted-foreground",
          )}
        >
          {outcome === "won" ? t("badges.won") : outcome === "lost" ? t("badges.lost") : t("badges.draw")}
        </span>
      </CardContent>
    </Card>
  );
}

function ProposeDialog({
  open,
  onOpenChange,
  onPropose,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPropose: (input: {
    friendId: string;
    metric: ChallengeMetricLabel;
    target: number;
    durationDays: number;
  }) => Promise<string | null>;
}) {
  const t = useTranslations("app.social.challenges");
  const friendsHookLabel = useTranslations("app.social.friends");
  const [friends, setFriends] = useState<{ id: string; name: string }[]>([]);
  const [friendId, setFriendId] = useState("");
  const [metric, setMetric] = useState<ChallengeMetricLabel>("xp");
  const [target, setTarget] = useState<number>(TARGET_PRESETS.xp[1]);
  const [durationDays, setDurationDays] = useState(7);
  const [saving, setSaving] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  // Carrega amigos quando o diálogo abre pela primeira vez.
  const [friendsLoaded, setFriendsLoaded] = useState(false);
  /* eslint-disable react-hooks/set-state-in-effect -- padrão dos hooks de dados */
  useEffect(() => {
    if (!open || friendsLoaded) return;
    setFriendsLoaded(true);
    void (async () => {
      try {
        const response = await fetch("/api/friends");
        if (!response.ok) return;
        const data = (await response.json()) as { friends: { id: string; name: string }[] };
        setFriends(data.friends);
      } catch {
        // diálogo mostra lista vazia
      }
    })();
  }, [open, friendsLoaded]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const changeMetric = (next: ChallengeMetricLabel) => {
    setMetric(next);
    setTarget(TARGET_PRESETS[next][1]);
  };

  const submit = async () => {
    if (!friendId || saving) return;
    setSaving(true);
    setDialogError(null);
    const error = await onPropose({ friendId, metric, target, durationDays });
    setSaving(false);
    if (error) setDialogError(error);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t("proposeTitle")}</DialogTitle>
          <DialogDescription>{t("proposeDescription")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-sm font-medium">{t("friendLabel")}</p>
            {friends.length === 0 ? (
              <p className="text-muted-foreground text-sm">{friendsHookLabel("empty")}</p>
            ) : (
              <select
                value={friendId}
                onChange={(event) => setFriendId(event.target.value)}
                className="border-border/60 bg-background h-9 w-full rounded-lg border px-3 text-sm"
              >
                <option value="">—</option>
                {friends.map((friend) => (
                  <option key={friend.id} value={friend.id}>
                    {friend.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="space-y-1.5">
            <p className="text-sm font-medium">{t("metricLabel")}</p>
            <div className="grid grid-cols-2 gap-2">
              {METRICS.map((candidate) => (
                <button
                  key={candidate}
                  type="button"
                  role="radio"
                  aria-checked={metric === candidate}
                  onClick={() => changeMetric(candidate)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm transition",
                    metric === candidate
                      ? "border-primary bg-primary/10 font-medium"
                      : "hover:bg-muted border-border/60",
                  )}
                >
                  {t(`metrics.${candidate}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-sm font-medium">{t("targetLabel")}</p>
            <Input
              type="number"
              min={1}
              value={Number.isNaN(target) ? "" : target}
              onChange={(event) => setTarget(Number.parseInt(event.target.value, 10))}
            />
            <div className="flex gap-2">
              {TARGET_PRESETS[metric].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setTarget(preset)}
                  className="hover:bg-muted rounded-full border border-border/60 px-2.5 py-0.5 text-xs transition"
                >
                  {preset.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-sm font-medium">{t("durationLabel")}</p>
            <div className="flex gap-2">
              {DURATIONS.map((days) => (
                <button
                  key={days}
                  type="button"
                  role="radio"
                  aria-checked={durationDays === days}
                  onClick={() => setDurationDays(days)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-sm transition",
                    durationDays === days
                      ? "border-primary bg-primary/10 font-medium"
                      : "hover:bg-muted border-border/60",
                  )}
                >
                  {t("days", { count: days })}
                </button>
              ))}
            </div>
          </div>

          {dialogError && <p className="text-destructive text-sm">{dialogError}</p>}

          <Button
            type="button"
            className="w-full"
            disabled={!friendId || !Number.isFinite(target) || target < 1 || saving}
            onClick={() => void submit()}
          >
            {saving ? <Spinner /> : t("submit")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
