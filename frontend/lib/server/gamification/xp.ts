import { Prisma } from "@/generated/prisma/client";
import { XP_AMOUNTS } from "@/lib/gamification/rules";
import { periodForFrequency } from "@/lib/server/completions";

type Tx = Prisma.TransactionClient;

/**
 * Concede XP de forma idempotente: a combinação (userId, kind, refKey) tem
 * unique no banco — repetir o mesmo evento não duplica pontos. Chamada
 * DENTRO da transação da mutação que originou o ganho.
 */
export async function awardXp(
  tx: Tx,
  userId: string,
  kind: string,
  amount: number,
  refKey?: string | null,
): Promise<void> {
  await tx.xpEvent.create({
    data: {
      userId,
      kind,
      refKey: refKey ?? null,
      amount,
    },
  });
}

/**
 * Concede XP ignorando violação de unicidade (variante "se ainda não
 * existe"). Útil quando a mutação pode re-disparar para o mesmo refKey.
 */
export async function awardXpOnce(
  tx: Tx,
  userId: string,
  kind: string,
  amount: number,
  refKey?: string | null,
): Promise<void> {
  try {
    await awardXp(tx, userId, kind, amount, refKey);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return;
    }
    throw error;
  }
}

/**
 * Remove os eventos de XP de uma referência (desfazer confirmação/recaída).
 * Usado para espelhar ganhos quando a ação original é desfeita — sem farm
 * de toggle.
 */
export async function removeXpForRef(
  tx: Tx,
  userId: string,
  kind: string,
  refKey: string,
): Promise<void> {
  await tx.xpEvent.deleteMany({ where: { userId, kind, refKey } });
}

/** Remove todos os eventos ligados a uma entidade (ex.: tarefa excluída). */
export async function removeXpByEntityPrefix(
  tx: Tx,
  userId: string,
  refPrefix: string,
): Promise<void> {
  await tx.xpEvent.deleteMany({
    where: { userId, refKey: { startsWith: refPrefix } },
  });
}

/* ---------------------------- Helpers por domínio --------------------------- */

export const xpRefKeys = {
  block: (blockId: string, periodStartMs: number) =>
    `block:${blockId}:${periodStartMs}`,
  taskDone: (taskId: string) => `task:${taskId}:done`,
  subtaskDone: (subtaskId: string) => `subtask:${subtaskId}:done`,
  habitConfirm: (habitId: string, dayStartMs: number) =>
    `habit:${habitId}:confirm:${dayStartMs}`,
  habitTarget: (habitId: string, windowStartMs: number) =>
    `habit:${habitId}:target:${windowStartMs}`,
  habitSlip: (habitId: string, dayStartMs: number) =>
    `habit:${habitId}:slip:${dayStartMs}`,
  dayFull: (dayStartMs: number) => `routine:dayFull:${dayStartMs}`,
};

/** XP de um bloco confirmado conforme o modo e o valor. */
export function blockConfirmXp(
  mode: "none" | "checklist" | "score",
  value: string,
): number {
  if (mode === "checklist") return value === "true" ? XP_AMOUNTS.blockChecklist : 0;
  if (mode === "score") {
    const score = Number.parseInt(value, 10);
    if (Number.isNaN(score)) return 0;
    return Math.max(0, score) * XP_AMOUNTS.blockScorePerPoint;
  }
  return 0;
}

/**
 * Dia 100% da rotina ativa: garante o evento (+25) quando todos os blocos
 * confirmáveis aplicáveis ao período atual estão confirmados, e o remove
 * caso contrário. Chamado após cada confirmação/desconfirmação de bloco.
 */
export async function syncRoutineDayFullXp(
  tx: Tx,
  userId: string,
  tzOffsetMinutes: number,
  now: Date = new Date(),
): Promise<void> {
  const routine = await tx.routine.findFirst({
    where: { userId, isActive: true },
    include: {
      timeBlocks: {
        where: { confirmation: { not: "none" } },
        select: { id: true, start: true },
      },
    },
  });

  const period = routine
    ? periodForFrequency(
        routine.frequency === "weekly" ? "weekly" : "daily",
        now,
        tzOffsetMinutes,
      )
    : null;
  if (!routine || !period) return;

  const userNow = new Date(now.getTime() - tzOffsetMinutes * 60_000);
  const dayKeyMs = Date.UTC(
    userNow.getUTCFullYear(),
    userNow.getUTCMonth(),
    userNow.getUTCDate(),
  );
  const refKey = xpRefKeys.dayFull(dayKeyMs);

  const applicableIds = routine.timeBlocks
    .filter(
      (block) =>
        routine.frequency !== "weekly" ||
        new Date(block.start.getTime() - tzOffsetMinutes * 60_000).getUTCDay() ===
          userNow.getUTCDay(),
    )
    .map((block) => block.id);

  let full = false;
  if (applicableIds.length > 0) {
    const completions = await tx.timeBlockCompletion.findMany({
      where: {
        userId,
        timeBlockId: { in: applicableIds },
        periodStart: period.start,
      },
      select: { timeBlockId: true, value: true, timeBlock: { select: { confirmation: true } } },
    });

    const validByBlock = new Set(
      completions
        .filter((completion) => {
          const mode = completion.timeBlock.confirmation;
          return mode === "checklist"
            ? completion.value === "true"
            : Number.parseInt(completion.value, 10) >= 1;
        })
        .map((completion) => completion.timeBlockId),
    );
    full = validByBlock.size >= applicableIds.length;
  }

  if (full) {
    await awardXpOnce(tx, userId, "routine.dayFull", XP_AMOUNTS.routineDayFull, refKey);
  } else {
    await removeXpForRef(tx, userId, "routine.dayFull", refKey);
  }
}
