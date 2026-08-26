import { describe, expect, it, vi } from "vitest";

import {
  publishRealtimeEvent,
  subscribeToUserEvents,
  type RealtimeEvent,
} from "@/lib/server/notifications/bus";

function makeEvent(id: string): RealtimeEvent {
  return {
    id,
    kind: "friend.request",
    params: { name: "Ana" },
    path: "/app/social",
    createdAt: new Date().toISOString(),
  };
}

describe("realtime bus", () => {
  it("entrega o evento aos listeners do usuário", () => {
    const received: RealtimeEvent[] = [];
    const unsubscribe = subscribeToUserEvents("user-a", (event) =>
      received.push(event),
    );

    publishRealtimeEvent("user-a", makeEvent("e1"));
    unsubscribe();

    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ id: "e1", kind: "friend.request" });
  });

  it("não entrega para outro usuário (isolamento)", () => {
    const received: RealtimeEvent[] = [];
    const unsubscribe = subscribeToUserEvents("user-b", (event) =>
      received.push(event),
    );

    publishRealtimeEvent("user-c", makeEvent("e2"));
    unsubscribe();

    expect(received).toHaveLength(0);
  });

  it("unsubscribe remove o listener (sem duplicação após desinscrever)", () => {
    const received: RealtimeEvent[] = [];
    const unsubscribe = subscribeToUserEvents("user-d", (event) =>
      received.push(event),
    );

    unsubscribe();
    publishRealtimeEvent("user-d", makeEvent("e3"));

    expect(received).toHaveLength(0);
  });

  it("suporta múltiplos listeners por usuário; um falho não afeta os demais", () => {
    const received: RealtimeEvent[] = [];
    const failing = vi.fn(() => {
      throw new Error("boom");
    });
    const unsub1 = subscribeToUserEvents("user-e", failing);
    const unsub2 = subscribeToUserEvents("user-e", (event) =>
      received.push(event),
    );

    expect(() => publishRealtimeEvent("user-e", makeEvent("e4"))).not.toThrow();
    expect(failing).toHaveBeenCalledTimes(1);
    expect(received).toHaveLength(1);

    unsub1();
    unsub2();
  });

  it("publish sem listeners é no-op seguro", () => {
    expect(() => publishRealtimeEvent("user-ghost", makeEvent("e5"))).not.toThrow();
  });
});
