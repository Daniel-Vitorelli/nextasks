"use client"

import { createContext, useContext } from "react";
import type { ReactNode } from "react";

interface SessionUser {
  name?: string;
  email?: string;
}

interface SessionContextValue {
  user?: SessionUser;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({
  value,
  children,
}: {
  value: SessionContextValue;
  children: ReactNode;
}) {
  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

// Uso: const { user } = useSession(); user?.name
export function useSession() {
  return useContext(SessionContext);
}
