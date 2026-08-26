/**
 * Bootstrap do servidor (Next.js instrumentation — runtime Node).
 * Inicia o loop de lembretes (web push) uma única vez por processo.
 *
 * O app roda em container de longa duração (docker compose), então um
 * setInterval in-process é suficiente; o dedup em NotificationLog protege
 * contra reinícios e sobreposição de ticks. Em um deploy serverless, trocar
 * por cron externo chamando runReminderSweep().
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const globalScope = globalThis as typeof globalThis & {
    __nextasksReminderTimer?: ReturnType<typeof setInterval>;
  };
  if (globalScope.__nextasksReminderTimer) return;

  const INTERVAL_MS = 30_000;

  const tick = async () => {
    try {
      // Import dinâmico: evita carregar prisma/web-push no bootstrap.
      const { runReminderSweep } = await import("@/lib/server/reminders");
      await runReminderSweep();
    } catch (error) {
      console.warn("[reminders] sweep failed:", error);
    }
  };

  globalScope.__nextasksReminderTimer = setInterval(() => {
    void tick();
  }, INTERVAL_MS);
}
