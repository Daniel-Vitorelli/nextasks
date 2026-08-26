"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ActivityFeedItem,
  FriendDetail,
  FriendsResponse,
  LeaderboardEntry,
  UserSearchResult,
} from "@/types/domain";
import { notifyDataChanged, useDataSync } from "@/lib/client/data-events";

/**
 * Carrega amigos + pedidos e expõe as mutações de amizade, busca de usuários,
 * ranking semanal e feed de atividade. Erros de API são propagados como
 * Error para a UI exibir mensagens (ex.: email inexistente).
 */
export function useFriends(tzOffset = 0) {
  const [data, setData] = useState<FriendsResponse>({
    friends: [],
    incoming: [],
    outgoing: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  // Dedup de chamadas em voo (padrão dos demais hooks).
  const inFlight = useRef(new Set<string>());
  // Controle de "já carregado" do ranking/feed (recarregam após mudanças).
  const leaderboardLoaded = useRef(false);
  const feedLoaded = useRef(false);

  const loadFriends = useCallback(async () => {
    try {
      const response = await fetch("/api/friends");
      if (!response.ok) throw new Error("Failed to load friends");
      setData((await response.json()) as FriendsResponse);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFriends();
  }, [loadFriends]);

  useDataSync(["friends"], loadFriends);

  // Mudanças de amizade invalidam ranking/feed carregados.
  const invalidateSocialData = useCallback(() => {
    leaderboardLoaded.current = false;
    feedLoaded.current = false;
  }, []);

  const run = useCallback(
    async (
      key: string,
      action: () => Promise<Response>,
      channels: Parameters<typeof notifyDataChanged>[0],
    ) => {
      if (inFlight.current.has(key)) return;
      inFlight.current.add(key);
      try {
        const response = await action();
        if (!response.ok) {
          let message = "";
          try {
            const body = (await response.json()) as { error?: string };
            message = body.error ?? "";
          } catch {
            // corpo sem JSON
          }
          throw new Error(message || `Request failed (${response.status})`);
        }
        await loadFriends();
        invalidateSocialData();
        notifyDataChanged(channels);
      } finally {
        inFlight.current.delete(key);
      }
    },
    [invalidateSocialData, loadFriends],
  );

  const inviteByEmail = useCallback(
    (email: string) =>
      run(
        `invite:${email}`,
        () =>
          fetch("/api/friends/requests", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
          }),
        ["friends"],
      ),
    [run],
  );

  const inviteByUserId = useCallback(
    (userId: string) =>
      run(
        `invite-user:${userId}`,
        () =>
          fetch("/api/friends/requests", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId }),
          }),
        ["friends"],
      ),
    [run],
  );

  const respondToRequest = useCallback(
    (requestId: string, action: "accept" | "decline") =>
      run(
        `respond:${requestId}`,
        () =>
          fetch(`/api/friends/requests/${requestId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action }),
          }),
        ["friends"],
      ),
    [run],
  );

  const cancelRequest = useCallback(
    (requestId: string) =>
      run(
        `cancel:${requestId}`,
        () =>
          fetch(`/api/friends/requests/${requestId}`, {
            method: "DELETE",
          }),
        ["friends"],
      ),
    [run],
  );

  const removeFriend = useCallback(
    (friendId: string) =>
      run(
        `remove:${friendId}`,
        () =>
          fetch(`/api/friends/${friendId}`, {
            method: "DELETE",
          }),
        ["friends"],
      ),
    [run],
  );

  const loadFriendDetail = useCallback(async (friendId: string): Promise<FriendDetail> => {
    const response = await fetch(`/api/friends/${friendId}`);
    if (!response.ok) throw new Error("Failed to load friend");
    return (await response.json()) as FriendDetail;
  }, []);

  /* ------------------------------ Busca ------------------------------- */
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchAbort = useRef<AbortController | null>(null);

  const searchUsers = useCallback(async (query: string) => {
    const trimmed = query.trim();
    searchAbort.current?.abort();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    const controller = new AbortController();
    searchAbort.current = controller;
    setIsSearching(true);
    try {
      const response = await fetch(
        `/api/users/search?q=${encodeURIComponent(trimmed)}`,
        { signal: controller.signal },
      );
      if (!response.ok) throw new Error("Search failed");
      const data = (await response.json()) as { results: UserSearchResult[] };
      setSearchResults(data.results);
    } catch (error) {
      if ((error as Error).name !== "AbortError") setSearchResults([]);
    } finally {
      if (!controller.signal.aborted) setIsSearching(false);
    }
  }, []);

  const clearSearch = useCallback(() => {
    searchAbort.current?.abort();
    setSearchResults([]);
    setIsSearching(false);
  }, []);

  /* --------------------------- Leaderboard ---------------------------- */
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);

  const loadLeaderboard = useCallback(async () => {
    if (leaderboardLoaded.current) return;
    leaderboardLoaded.current = true;
    setIsLoadingLeaderboard(true);
    try {
      const response = await fetch(`/api/friends/leaderboard?tzOffset=${tzOffset}`);
      if (!response.ok) throw new Error("Failed");
      const data = (await response.json()) as { entries: LeaderboardEntry[] };
      setLeaderboard(data.entries);
    } catch {
      setLeaderboard([]);
    } finally {
      setIsLoadingLeaderboard(false);
    }
  }, [tzOffset]);

  /* ------------------------------- Feed -------------------------------- */
  const [feed, setFeed] = useState<ActivityFeedItem[]>([]);
  const [isLoadingFeed, setIsLoadingFeed] = useState(false);

  const loadFeed = useCallback(async () => {
    if (feedLoaded.current) return;
    feedLoaded.current = true;
    setIsLoadingFeed(true);
    try {
      const response = await fetch("/api/social/feed?limit=30");
      if (!response.ok) throw new Error("Failed");
      const data = (await response.json()) as { items: ActivityFeedItem[] };
      setFeed(data.items);
    } catch {
      setFeed([]);
    } finally {
      setIsLoadingFeed(false);
    }
  }, []);

  return {
    data,
    isLoading,
    inviteByEmail,
    inviteByUserId,
    respondToRequest,
    cancelRequest,
    removeFriend,
    loadFriendDetail,
    reload: loadFriends,
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
  };
}
