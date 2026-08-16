"use client";

import * as React from "react";

import type {
  ConnectionPatch,
  ConnectionsResponse,
  TaskBlockConnection,
} from "@/types/domain";

/** Disparado após qualquer mutação de conexão (hooks de tarefas recarregam). */
export const CONNECTIONS_CHANGED_EVENT = "nexasks:connections-changed";

interface ToggleParams {
  taskId?: string | null;
  subtaskId?: string | null;
  timeBlockId: string;
}

interface ConnectionsContextValue {
  data: ConnectionsResponse | null;
  isLoading: boolean;
  reload: () => Promise<void>;
  toggleConnection: (params: ToggleParams) => Promise<void>;
  updateConnection: (id: string, patch: ConnectionPatch) => Promise<void>;
}

const ConnectionsContext = React.createContext<ConnectionsContextValue | null>(
  null,
);

export function ConnectionsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [data, setData] = React.useState<ConnectionsResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const reload = React.useCallback(async () => {
    const tzOffsetMinutes = new Date().getTimezoneOffset();
    try {
      const response = await fetch(
        `/api/connections?tzOffset=${tzOffsetMinutes}`,
      );

      if (!response.ok) {
        throw new Error("Failed to load connections");
      }

      setData((await response.json()) as ConnectionsResponse);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    let active = true;

    (async () => {
      const tzOffsetMinutes = new Date().getTimezoneOffset();
      try {
        const response = await fetch(
          `/api/connections?tzOffset=${tzOffsetMinutes}`,
        );

        if (!response.ok) {
          throw new Error("Failed to load connections");
        }

        if (active) {
          setData((await response.json()) as ConnectionsResponse);
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (active) setIsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const notifyChanged = React.useCallback(() => {
    window.dispatchEvent(new Event(CONNECTIONS_CHANGED_EVENT));
  }, []);

  const toggleConnection = React.useCallback(
    async (params: ToggleParams) => {
      const existing = data?.connections.find(
        (connection) =>
          connection.timeBlockId === params.timeBlockId &&
          (params.taskId
            ? connection.taskId === params.taskId
            : connection.subtaskId === params.subtaskId),
      );

      if (existing) {
        setData(
          (current) =>
            current && {
              ...current,
              connections: current.connections.filter(
                (connection) => connection.id !== existing.id,
              ),
            },
        );

        const response = await fetch(`/api/connections/${existing.id}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          await reload();
          throw new Error("Failed to remove connection");
        }
      } else {
        const pending: TaskBlockConnection = {
          id: `pending-${params.timeBlockId}`,
          taskId: params.taskId ?? null,
          subtaskId: params.subtaskId ?? null,
          timeBlockId: params.timeBlockId,
          requiredCount: 1,
          dayFilter: "all",
          confirmedCount: 0,
        };

        setData(
          (current) =>
            current && {
              ...current,
              connections: [...current.connections, pending],
            },
        );

        const tzOffsetMinutes = new Date().getTimezoneOffset();
        const response = await fetch(
          `/api/connections?tzOffset=${tzOffsetMinutes}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              taskId: params.taskId ?? null,
              subtaskId: params.subtaskId ?? null,
              timeBlockId: params.timeBlockId,
            }),
          },
        );

        if (!response.ok) {
          await reload();
          throw new Error("Failed to create connection");
        }

        const { connection } = (await response.json()) as {
          connection: TaskBlockConnection;
        };

        setData((current) => {
          if (!current) return current;
          const rest = current.connections.filter(
            (item) => item.id !== pending.id,
          );
          return { ...current, connections: [...rest, connection] };
        });
      }

      notifyChanged();
    },
    [data, reload, notifyChanged],
  );

  const updateConnection = React.useCallback(
    async (id: string, patch: ConnectionPatch) => {
      const previous = data?.connections.find((connection) => connection.id === id);
      if (!previous) return;

      setData(
        (current) =>
          current && {
            ...current,
            connections: current.connections.map((connection) =>
              connection.id === id ? { ...connection, ...patch } : connection,
            ),
          },
      );

      const tzOffsetMinutes = new Date().getTimezoneOffset();

      try {
        const response = await fetch(
          `/api/connections/${id}?tzOffset=${tzOffsetMinutes}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
          },
        );

        if (!response.ok) {
          throw new Error("Failed to update connection");
        }

        const { connection } = (await response.json()) as {
          connection: TaskBlockConnection;
        };

        setData(
          (current) =>
            current && {
              ...current,
              connections: current.connections.map((item) =>
                item.id === id ? connection : item,
              ),
            },
        );
        notifyChanged();
      } catch (error) {
        setData(
          (current) =>
            current && {
              ...current,
              connections: current.connections.map((item) =>
                item.id === id ? previous : item,
              ),
            },
        );
        throw error;
      }
    },
    [data, notifyChanged],
  );

  const value = React.useMemo(
    () => ({ data, isLoading, reload, toggleConnection, updateConnection }),
    [data, isLoading, reload, toggleConnection, updateConnection],
  );

  return (
    <ConnectionsContext.Provider value={value}>
      {children}
    </ConnectionsContext.Provider>
  );
}

export function useConnections(): ConnectionsContextValue {
  const context = React.useContext(ConnectionsContext);
  if (!context) {
    throw new Error("useConnections must be used within ConnectionsProvider");
  }
  return context;
}