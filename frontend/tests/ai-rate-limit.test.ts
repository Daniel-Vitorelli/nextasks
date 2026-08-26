import { describe, expect, it } from "vitest";
import { AbortedError, createAiRateLimiter } from "@/lib/server/ai/rate-limit";

/** Relógio manual para simular a passagem do tempo. */
function makeClock() {
  let current = 1_000_000;
  const waiters: { resolve: () => void; at: number }[] = [];
  return {
    now: () => current,
    advance(ms: number) {
      current += ms;
      const due = waiters.filter((waiter) => waiter.at <= current);
      for (const waiter of due) waiter.resolve();
      return due;
    },
    delay: (ms: number) =>
      new Promise<void>((resolve) => {
        waiters.push({ resolve, at: current + ms });
      }),
  };
}

describe("createAiRateLimiter", () => {
  it("permite até rpm chamadas imediatamente", async () => {
    const clock = makeClock();
    const limiter = createAiRateLimiter({ rpm: 3, windowMs: 60_000, now: clock.now, delay: clock.delay });

    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();

    expect(limiter.activeCount()).toBe(3);
    expect(limiter.queuedCount()).toBe(0);
  });

  it("enfileira a chamada excedente e libera após a janela", async () => {
    const clock = makeClock();
    const limiter = createAiRateLimiter({ rpm: 2, windowMs: 60_000, now: clock.now, delay: clock.delay });

    await limiter.acquire(); // slot 1
    await limiter.acquire(); // slot 2

    // Excedente entra em fila; NÃO deve resolver antes da janela girar.
    let acquired = false;
    const queued = limiter.acquire().then(() => {
      acquired = true;
    });

    await Promise.resolve();
    expect(acquired).toBe(false);
    expect(limiter.queuedCount()).toBe(1);

    // Avança além da expiração dos slots e processa os timers pendentes.
    clock.advance(60_100);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await queued;

    expect(acquired).toBe(true);
  });

  it("expira slots antigos gradualmente (janela deslizante)", async () => {
    const clock = makeClock();
    const limiter = createAiRateLimiter({ rpm: 2, windowMs: 60_000, now: clock.now, delay: clock.delay });

    await limiter.acquire();
    clock.advance(30_000);
    await limiter.acquire();
    expect(limiter.activeCount()).toBe(2);

    // Aos 60s+, o primeiro slot saiu da janela → nova chamada passa sem fila.
    clock.advance(30_500);
    await limiter.acquire();
    expect(limiter.activeCount()).toBe(2);
  });

  it("vários esperadores são liberados conforme slots abrem", async () => {
    const clock = makeClock();
    const limiter = createAiRateLimiter({ rpm: 2, windowMs: 60_000, now: clock.now, delay: clock.delay });

    await limiter.acquire();
    await limiter.acquire();

    const order: number[] = [];
    const waiters = [
      limiter.acquire().then(() => order.push(1)),
      limiter.acquire().then(() => order.push(2)),
      limiter.acquire().then(() => order.push(3)),
    ];
    expect(limiter.queuedCount()).toBe(3);

    // Primeira virada de janela libera rpm=2 esperadores…
    clock.advance(60_100);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(order).toEqual([1, 2]);
    expect(limiter.queuedCount()).toBe(1);

    // …e a segunda libera o restante.
    clock.advance(60_100);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await Promise.all(waiters);

    expect(order).toEqual([1, 2, 3]);
  });
});

describe("AbortedError", () => {
  it("é identificável pelo name AbortError", () => {
    const error = new AbortedError();
    expect(error.name).toBe("AbortError");
  });
});
