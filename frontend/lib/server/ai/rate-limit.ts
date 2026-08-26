/**
 * Rate limiter GLOBAL para chamadas à NVIDIA NIM (janela deslizante).
 *
 * Sem limite por usuário: todas as requisições do servidor competem pelo
 * mesmo orçamento de ~GLOBAL_AI_RPM chamadas por minuto. Quando a janela
 * está cheia, o chamador AGUARDA em fila até abrir o próximo slot — nada
 * é rejeitado com 429.
 *
 * Em memória e por processo: suficiente para o deploy atual (um único
 * container next_app). Se um dia houver múltiplas instâncias, trocar por
 * um limiter distribuído (ex.: Redis) mantendo esta mesma interface.
 */

export interface AiRateLimiterOptions {
  /** Chamadas permitidas por janela (default: env GLOBAL_AI_RPM ou 20). */
  rpm?: number;
  /** Tamanho da janela em ms (default 60_000). */
  windowMs?: number;
  /** Relógio injetável para testes. */
  now?: () => number;
  /** Espera injetável para testes. */
  delay?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

export interface AiRateLimiter {
  /** Resolve quando um slot da janela atual estiver disponível (e o ocupa). */
  acquire(signal?: AbortSignal): Promise<void>;
  /** Quantidade de chamadas ocupando a janela corrente (observabilidade/testes). */
  activeCount(): number;
  /** Chamadores aguardando slot (observabilidade/testes). */
  queuedCount(): number;
}

export class AbortedError extends Error {
  constructor() {
    super("Aborted while waiting for rate limit slot");
    this.name = "AbortError";
  }
}

const DEFAULT_SLEEP_MS_BUFFER = 25;

export function createAiRateLimiter(options: AiRateLimiterOptions = {}): AiRateLimiter {
  const rpm =
    options.rpm ??
    (Number.parseInt(process.env.GLOBAL_AI_RPM ?? "", 10) || 20);
  const windowMs = options.windowMs ?? 60_000;
  const now = options.now ?? (() => Date.now());
  const delay =
    options.delay ??
    ((ms: number, signal?: AbortSignal) =>
      new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, ms);
        signal?.addEventListener(
          "abort",
          () => {
            clearTimeout(timer);
            reject(new AbortedError());
          },
          { once: true },
        );
      }));

  // Instantes (ms) das chamadas aceitas dentro da janela corrente, ordenados.
  let slots: number[] = [];
  let queued = 0;

  async function acquire(signal?: AbortSignal): Promise<void> {
    queued += 1;
    try {
      // Laço FIFO-prático: cada esperador dorme até o slot mais antigo sair
      // da janela, então recompete. Sob disputa, quem acordar primeiro vence
      // e os demais voltam a dormir — sem starvation significativa.
      for (;;) {
        const current = now();
        slots = slots.filter((timestamp) => timestamp > current - windowMs);

        if (slots.length < rpm) {
          slots.push(current);
          return;
        }

        const waitMs = slots[0] + windowMs - current + DEFAULT_SLEEP_MS_BUFFER;
        await delay(waitMs, signal);
      }
    } finally {
      queued -= 1;
    }
  }

  return {
    acquire,
    activeCount: () => slots.filter((timestamp) => timestamp > now() - windowMs).length,
    queuedCount: () => queued,
  };
}

/** Singleton usado pelas rotas (um só orçamento por processo). */
export const aiRateLimiter = createAiRateLimiter();

/** Conveniência para módulos que só precisam esperar um slot. */
export function acquireAiSlot(signal?: AbortSignal): Promise<void> {
  return aiRateLimiter.acquire(signal);
}
