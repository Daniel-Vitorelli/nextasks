"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { authClient } from "@/lib/auth-client";

export interface SessionUser {
  id?: string;
  name?: string;
  email?: string;
  timezoneOffset?: number | null;
  image?: string | null;
}

interface SessionContextValue {
  user?: SessionUser | null;
  /** Recarrega o perfil completo (ex.: após salvar o fuso horário). */
  refetchUser: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({
  initialUser,
  children,
}: {
  initialUser?: SessionUser | null;
  children: ReactNode;
}) {
  const { data: session } = authClient.useSession();
  const sessionUser = (session?.user ?? null) as SessionUser | null;
  const [profile, setProfile] = useState<SessionUser | null | undefined>(
    undefined,
  );

  // A sessão do better-auth reflete login/logout e o nome; o perfil completo
  // (inclui timezoneOffset) vem da nossa própria API para não depender de
  // colunas customizadas no payload de sessão.
  const refetchUser = useCallback(async () => {
    if (!sessionUser?.id) {
      setProfile(null);
      return;
    }
    try {
      const response = await fetch("/api/user");
      if (response.ok) {
        setProfile((await response.json()) as SessionUser);
      }
    } catch {
      // Mantém o perfil atual em caso de falha de rede.
    }
  }, [sessionUser?.id]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void refetchUser();
  }, [refetchUser]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const user = profile ?? sessionUser ?? initialUser ?? null;

  const value = useMemo(() => ({ user, refetchUser }), [user, refetchUser]);

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

// Uso: const { user } = useSession() ?? {}; user?.name
export function useSession() {
  return useContext(SessionContext);
}