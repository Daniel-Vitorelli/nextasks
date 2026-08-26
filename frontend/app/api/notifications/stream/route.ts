import { requireUser } from "@/lib/server/api";
import {
  subscribeToUserEvents,
  type RealtimeEvent,
} from "@/lib/server/notifications/bus";

export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 30_000;

/**
 * GET /api/notifications/stream — canal SSE de eventos em tempo real para o
 * app aberto (toasts in-app + refresh dos dados). Com o site fechado quem
 * entrega é o Web Push; aqui é a via "live".
 */
export async function GET(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;
  if (!user) return new Response(null, { status: 401 });

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (payload: string) => {
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          // Stream já fechado: limpa abaixo via cancel/close.
        }
      };

      // Handshake inicial (cliente pode confirmar conectividade).
      send(`event: ready\ndata: {"connected":true}\n\n`);

      unsubscribe = subscribeToUserEvents(
        user.id,
        (event: RealtimeEvent) => {
          send(`event: notification\ndata: ${JSON.stringify(event)}\n\n`);
        },
      );

      heartbeat = setInterval(() => {
        // Comentário SSE: mantém proxies vivos sem disparar handlers.
        send(`: ping\n\n`);
      }, HEARTBEAT_MS);

      request.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {
          // já fechado
        }
      });
    },
    cancel() {
      cleanup();
    },
  });

  function cleanup() {
    unsubscribe?.();
    unsubscribe = null;
    if (heartbeat) {
      clearInterval(heartbeat);
      heartbeat = null;
    }
  }

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
