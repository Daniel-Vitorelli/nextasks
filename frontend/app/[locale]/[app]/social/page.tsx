"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useLocale, useMessages, useTranslations } from "next-intl";
import { formatDistanceToNowStrict } from "date-fns";
import { enUS, ptBR } from "date-fns/locale";
import {
  Award,
  Check,
  Medal,
  Search,
  Send,
  Sparkles,
  Trash2,
  TrendingUp,
  Trophy,
  UserMinus,
  Users,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
  blockBorderClass,
  solidTextOnColor,
} from "@/components/connections/connection-colors";
import { LUCIDE_ICON_MAP } from "@/lib/lucide-icons";
import { useFriends } from "@/hooks/use-friends";
import type {
  ActivityFeedItem,
  FriendDetail,
  FriendProfile,
  LeaderboardEntry,
  RankDef,
  UserSearchResult,
} from "@/types/domain";

type SocialTab = "friends" | "requests" | "ranking" | "activity";

function initialsOf(name?: string | null): string {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

function Avatar({
  user,
  size = "md",
}: {
  user: Pick<FriendProfile, "name" | "image">;
  size?: "sm" | "md" | "lg";
}) {
  const dimension =
    size === "lg"
      ? "size-20 text-xl"
      : size === "sm"
        ? "size-10 text-xs"
        : "size-12 text-sm";
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted font-semibold text-muted-foreground",
        dimension,
      )}
    >
      {user.image ? (
        <Image
          alt={user.name}
          className="size-full object-cover"
          height={80}
          src={user.image}
          unoptimized
          width={80}
        />
      ) : (
        initialsOf(user.name) || "?"
      )}
    </div>
  );
}

function RankMedal({ rank }: { rank: RankDef }) {
  const t = useTranslations("app.gamification");
  const Icon = LUCIDE_ICON_MAP[rank.icon] ?? LUCIDE_ICON_MAP.Trophy;
  return (
    <span
      title={t(rank.nameKey)}
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full shadow-sm",
        blockBorderClass(rank.color),
        solidTextOnColor[rank.color],
      )}
    >
      <Icon className="size-4" />
    </span>
  );
}

export default function SocialPage() {
  const t = useTranslations("app.social");
  const locale = useLocale();
  const tzOffset = -new Date().getTimezoneOffset();
  const {
    data,
    isLoading,
    inviteByEmail,
    inviteByUserId,
    respondToRequest,
    cancelRequest,
    removeFriend,
    loadFriendDetail,
    searchUsers,
    clearSearch,
    searchResults,
    isSearching,
    leaderboard,
    isLoadingLeaderboard,
    loadLeaderboard,
    feed,
    isLoadingFeed,
    loadFeed,
  } = useFriends(tzOffset);

  const [tab, setTab] = useState<SocialTab>("friends");
  const [detail, setDetail] = useState<FriendDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Busca com debounce de 300ms.
  const [query, setQuery] = useState("");
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      clearSearch();
      return;
    }
    const timer = setTimeout(() => void searchUsers(trimmed), 300);
    return () => clearTimeout(timer);
  }, [query, clearSearch, searchUsers]);

  // Carrega ranking/feed na primeira visita à aba.
  useEffect(() => {
    if (tab === "ranking") void loadLeaderboard();
    if (tab === "activity") void loadFeed();
  }, [tab, loadLeaderboard, loadFeed]);

  const openDetail = async (friendId: string) => {
    setDetailLoading(true);
    try {
      setDetail(await loadFriendDetail(friendId));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleInvite = async (email: string) => {
    try {
      await inviteByEmail(email);
      setQuery("");
      clearSearch();
    } catch {
      // erro silencioso: o convite por busca cobre os casos comuns
    }
  };

  const pendingCount = data.incoming.length;

  const tabs = useMemo(
    () =>
      [
        { id: "friends" as const, label: t("tabs.friends") },
        {
          id: "requests" as const,
          label: t("tabs.requests"),
          badge: pendingCount > 0 ? pendingCount : undefined,
        },
        { id: "ranking" as const, label: t("tabs.ranking") },
        { id: "activity" as const, label: t("tabs.activity") },
      ],
    [t, pendingCount],
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-4 py-12 md:px-8">
      <header className="space-y-1.5">
        <p className="font-jetbrainsMono text-sm text-muted-foreground uppercase tracking-[0.2em]">
          {t("eyebrow")}
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </header>

      {/* Buscar / convidar */}
      <InviteCard
        query={query}
        onQueryChange={setQuery}
        results={searchResults}
        isSearching={isSearching}
        onInvite={handleInvite}
        onInviteUser={(userId) => inviteByUserId(userId)}
        onRespond={(requestId, action) => respondToRequest(requestId, action)}
      />

      {/* Abas */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-3">
        {tabs.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setTab(entry.id)}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition",
              tab === entry.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {entry.label}
            {entry.badge !== undefined && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none",
                  tab === entry.id ? "bg-primary-foreground/20" : "bg-destructive text-white",
                )}
              >
                {entry.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Conteúdo da aba */}
      {tab === "friends" && (
        <FriendsTab
          isLoading={isLoading}
          friends={data.friends}
          onOpenDetail={(friendId) => void openDetail(friendId)}
          onRemove={(friendId) => void removeFriend(friendId)}
        />
      )}

      {tab === "requests" && (
        <RequestsTab
          incoming={data.incoming}
          outgoing={data.outgoing}
          onRespond={(requestId, action) => void respondToRequest(requestId, action)}
          onCancel={(requestId) => void cancelRequest(requestId)}
        />
      )}

      {tab === "ranking" && (
        <RankingTab
          entries={leaderboard}
          isLoading={isLoadingLeaderboard}
          locale={locale}
        />
      )}

      {tab === "activity" && <ActivityTab items={feed} isLoading={isLoadingFeed} />}

      {/* Detalhe público do amigo */}
      <Dialog
        open={detail !== null || detailLoading}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
      >
        <DialogContent className="max-w-md">
          {detailLoading || !detail ? (
            <div className="flex items-center justify-center py-10">
              <Spinner className="size-6" />
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3 pr-6">
                  <Avatar user={detail.profile} />
                  <span className="min-w-0 truncate">{detail.profile.name}</span>
                </DialogTitle>
                <DialogDescription>
                  {t("friends.level", { level: detail.profile.level })} ·{" "}
                  {detail.profile.totalXp.toLocaleString()} XP
                </DialogDescription>
              </DialogHeader>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Stat label={t("detail.blocksConfirmed")} value={detail.blocksConfirmed} />
                <Stat label={t("detail.tasksDone")} value={detail.tasksDone} />
                <Stat label={t("detail.days100")} value={detail.days100} />
                <Stat label={t("detail.unlockedCount")} value={detail.unlockedCount} />
                <Stat label={t("detail.currentRoutineStreak")} value={detail.currentRoutineStreak} />
                <Stat label={t("detail.bestCleanStreak")} value={detail.bestCleanStreak} />
              </dl>
            </>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}

/* ---------------------------- Aba Amigos ---------------------------- */

function FriendsTab({
  isLoading,
  friends,
  onOpenDetail,
  onRemove,
}: {
  isLoading: boolean;
  friends: FriendProfile[];
  onOpenDetail: (friendId: string) => void;
  onRemove: (friendId: string) => void;
}) {
  const t = useTranslations("app.social");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-border/60 bg-card py-16">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (friends.length === 0) {
    return (
      <p className="text-muted-foreground rounded-xl border border-dashed border-border/60 py-12 text-center text-sm">
        {t("friends.empty")}
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {friends.map((friend) => (
        <Card key={friend.id}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Avatar user={friend} />
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => onOpenDetail(friend.id)}
              >
                <p className="truncate font-medium hover:underline">{friend.name}</p>
                <p className="text-muted-foreground text-xs">
                  {t("friends.level", { level: friend.level })} ·{" "}
                  {friend.totalXp.toLocaleString()} XP
                </p>
              </button>
              <RankMedal rank={friend.rank} />
              <Button
                size="icon"
                variant="ghost"
                aria-label={t("friends.remove")}
                title={t("friends.remove")}
                onClick={() => onRemove(friend.id)}
              >
                <UserMinus className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* --------------------------- Aba Pedidos ----------------------------- */

function RequestsTab({
  incoming,
  outgoing,
  onRespond,
  onCancel,
}: {
  incoming: { id: string; createdAt: string; user: FriendProfile }[];
  outgoing: { id: string; createdAt: string; user: FriendProfile }[];
  onRespond: (requestId: string, action: "accept" | "decline") => void;
  onCancel: (requestId: string) => void;
}) {
  const t = useTranslations("app.social");

  if (incoming.length === 0 && outgoing.length === 0) {
    return (
      <p className="text-muted-foreground rounded-xl border border-dashed border-border/60 py-12 text-center text-sm">
        {t("requests.empty")}
      </p>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {incoming.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
            {t("requests.incomingTitle")}
          </h3>
          {incoming.map((request) => (
            <Card key={request.id}>
              <CardContent className="flex items-center gap-3 p-4">
                <Avatar user={request.user} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{request.user.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {t("friends.level", { level: request.user.level })}
                  </p>
                </div>
                <Button
                  size="icon"
                  aria-label={t("requests.accept")}
                  title={t("requests.accept")}
                  onClick={() => onRespond(request.id, "accept")}
                >
                  <Check className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  aria-label={t("requests.decline")}
                  title={t("requests.decline")}
                  onClick={() => onRespond(request.id, "decline")}
                >
                  <X className="size-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      {outgoing.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
            {t("requests.outgoingTitle")}
          </h3>
          {outgoing.map((request) => (
            <Card key={request.id}>
              <CardContent className="flex items-center gap-3 p-4">
                <Avatar user={request.user} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{request.user.name}</p>
                  <span className="text-muted-foreground text-[11px]">
                    {t("requests.pendingBadge")}
                  </span>
                </div>
                <Button
                  size="icon"
                  variant="outline"
                  aria-label={t("requests.cancel")}
                  title={t("requests.cancel")}
                  onClick={() => onCancel(request.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}

/* -------------------------- Aba Ranking ------------------------------ */

const POSITION_ICONS = [
  { icon: Trophy, color: "text-yellow-500" },
  { icon: Medal, color: "text-slate-400" },
  { icon: Award, color: "text-orange-400" },
];

function RankingTab({
  entries,
  isLoading,
  locale,
}: {
  entries: LeaderboardEntry[];
  isLoading: boolean;
  locale: string;
}) {
  const t = useTranslations("app.social");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-border/60 bg-card py-16">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <p className="text-muted-foreground rounded-xl border border-dashed border-border/60 py-12 text-center text-sm">
        {t("leaderboard.empty")}
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
      {entries.map((entry, index) => {
        const PositionIcon =
          index < POSITION_ICONS.length ? POSITION_ICONS[index] : null;
        return (
          <div
            key={entry.userId}
            className={cn(
              "flex items-center gap-3 px-4 py-3",
              index > 0 && "border-t border-border/60",
              entry.isMe && "bg-accent/50",
            )}
          >
            <span className="flex w-7 shrink-0 items-center justify-center">
              {PositionIcon ? (
                <PositionIcon.icon className={cn("size-5", PositionIcon.color)} />
              ) : (
                <span className="text-muted-foreground text-sm font-bold tabular-nums">
                  {index + 1}
                </span>
              )}
            </span>
            <Avatar user={entry} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {entry.name}
                {entry.isMe && (
                  <span className="text-muted-foreground ml-2 text-[11px] font-normal uppercase tracking-wide">
                    ({t("leaderboard.you")})
                  </span>
                )}
              </p>
              <p className="text-muted-foreground text-xs">
                {t("friends.level", { level: entry.level })}
              </p>
            </div>
            <RankMedal rank={entry.rank} />
            <span className="w-24 shrink-0 text-right font-jetbrainsMono text-sm font-bold tabular-nums">
              +{entry.weekXp.toLocaleString(locale === "pt" ? "pt-BR" : "en-US")}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------- Aba Atividade ------------------------------ */

function ActivityTab({
  items,
  isLoading,
}: {
  items: ActivityFeedItem[];
  isLoading: boolean;
}) {
  const t = useTranslations("app.social");
  const locale = useLocale();

  const timeAgo = (createdAt: string) =>
    formatDistanceToNowStrict(new Date(createdAt), {
      addSuffix: true,
      locale: locale === "pt" ? ptBR : enUS,
    });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-border/60 bg-card py-16">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="text-muted-foreground rounded-xl border border-dashed border-border/60 py-12 text-center text-sm">
        {t("activity.empty")}
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
      {items.map((item) => (
        <ActivityRow key={item.id} item={item} timeAgo={timeAgo} />
      ))}
    </div>
  );
}

function ActivityRow({
  item,
  timeAgo,
}: {
  item: ActivityFeedItem;
  timeAgo: (iso: string) => string;
}) {
  const t = useTranslations("app.social");
  const messages = useMessages() as {
    app?: { gamification?: { achievements?: Record<string, { name?: string }> } };
  };

  const achievementName =
    typeof item.data.achievementId === "string"
      ? (messages.app?.gamification?.achievements?.[item.data.achievementId]
          ?.name ?? String(item.data.achievementId))
      : "";

  const text =
    item.kind === "achievement.unlock"
      ? t("activity.kinds.achievement", {
          name: item.actorName,
          achievement: achievementName,
        })
      : item.kind === "level.up"
        ? t("activity.kinds.levelUp", {
            name: item.actorName,
            level: Number(item.data.level ?? 0),
          })
        : t("activity.kinds.friendAccepted", {
            name: item.actorName,
            other: String(item.data.otherName ?? ""),
          });

  const KindIcon =
    item.kind === "achievement.unlock"
      ? Trophy
      : item.kind === "level.up"
        ? TrendingUp
        : Users;

  return (
    <div className="flex items-center gap-3 px-4 py-3 [&:not(:first-child)]:border-t [&:not(:first-child)]:border-border/60">
      <Avatar user={{ name: item.actorName, image: item.actorImage }} size="sm" />
      <KindIcon className="text-muted-foreground size-4 shrink-0" />
      <p className="min-w-0 flex-1 text-sm">{text}</p>
      <span className="text-muted-foreground shrink-0 text-xs whitespace-nowrap">
        {timeAgo(item.createdAt)}
      </span>
    </div>
  );
}

/* ---------------------- Cartão de busca/convite ----------------------- */

function InviteCard({
  query,
  onQueryChange,
  results,
  isSearching,
  onInvite,
  onInviteUser,
  onRespond,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  results: UserSearchResult[];
  isSearching: boolean;
  onInvite: (email: string) => Promise<void>;
  onInviteUser: (userId: string) => Promise<void>;
  onRespond: (requestId: string, action: "accept" | "decline") => Promise<void>;
}) {
  const t = useTranslations("app.social");
  const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(query.trim());
  const showEmailFallback =
    looksLikeEmail &&
    !isSearching &&
    !results.some(
      (result) => result.name.toLowerCase() === query.trim().toLowerCase(),
    );
  const [pendingInvite, setPendingInvite] = useState<string | null>(null);
  const [invited, setInvited] = useState<string | null>(null);

  // Limpa o estado "convite enviado" após alguns segundos.
  useEffect(() => {
    if (!invited) return;
    const timer = setTimeout(() => setInvited(null), 4000);
    return () => clearTimeout(timer);
  }, [invited]);

  const sendInvite = async (value: string) => {
    if (pendingInvite) return;
    const key = value.toLowerCase();
    setPendingInvite(key);
    try {
      // Resultados da busca vão por id; o fallback do rodapé é um e-mail.
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        await onInvite(value);
      } else {
        await onInviteUser(value);
      }
      setInvited(key);
    } finally {
      setPendingInvite(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("invite.title")}</CardTitle>
        <CardDescription>{t("invite.searchDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={t("invite.searchPlaceholder")}
            className="pl-9"
          />
        </div>

        {isSearching && (
          <div className="flex justify-center py-3">
            <Spinner className="size-5" />
          </div>
        )}

        {!isSearching && results.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-border/60">
            {results.map((result) => (
              <div
                key={result.id}
                className="flex items-center gap-3 px-3 py-2.5 [&:not(:first-child)]:border-t [&:not(:first-child)]:border-border/60"
              >
                <Avatar user={result} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{result.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {t("friends.level", { level: result.level })}
                  </p>
                </div>
                <RankMedal rank={result.rank} />
                {result.relationStatus === "none" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={pendingInvite !== null}
                    onClick={() => void sendInvite(result.id)}
                  >
                    <Send className="size-3.5" />
                    {t("invite.submit")}
                  </Button>
                )}
                {result.relationStatus === "outgoing" && (
                  <span className="text-muted-foreground text-xs">
                    {t("requests.pendingBadge")}
                  </span>
                )}
                {result.relationStatus === "incoming" && (
                  <Button
                    size="sm"
                    onClick={() =>
                      void onRespond(result.id, "accept").then(() => undefined)
                    }
                  >
                    <Check className="size-3.5" />
                    {t("requests.accept")}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {!isSearching && showEmailFallback && invited !== query.trim().toLowerCase() && (
          <button
            type="button"
            className="hover:bg-muted flex items-center gap-2 rounded-lg border border-dashed border-border/60 px-3 py-2.5 text-sm transition"
            onClick={() => void sendInvite(query.trim())}
          >
            <Sparkles className="text-muted-foreground size-4" />
            {t("invite.sendToEmail", { email: query.trim() })}
          </button>
        )}

        {invited && (
          <p className="text-sm text-muted-foreground">{t("invite.success")}</p>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border/60 p-3">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-lg font-bold tabular-nums">{value.toLocaleString()}</dd>
    </div>
  );
}
