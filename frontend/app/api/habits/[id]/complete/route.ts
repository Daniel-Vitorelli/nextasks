import { NextResponse } from "next/server";

import { prisma } from "@/lib/server/prisma";
import {
  badRequest,
  notFound,
  parseTzOffset,
  requireUser,
} from "@/lib/server/api";
import {
  completeHabitsForConnections,
  confirmBlocksForHabits,
  reversePropagateForBlock,
} from "@/lib/server/connections";
import {
  awardXpOnce,
  removeXpForRef,
  xpRefKeys,
} from "@/lib/server/gamification/xp";
import { XP_AMOUNTS } from "@/lib/gamification/rules";
import { evaluateAchievements } from "@/lib/server/gamification/service";
import { loadGamificationStats } from "@/lib/server/gamification/stats";
import { sendGamificationNotifications } from "@/lib/server/notifications/gamification-hooks";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function parseDaysOfWeek(value: string): number[] {
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
    }
  } catch {
    return [];
  }
  return [];
}

export async function POST(request: Request, { params }: RouteParams) {
  const { user, response } = await requireUser();
  if (response) return response;

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const tzOffset = parseTzOffset(searchParams.get("tzOffset"));

  const body = await request.json().catch(() => ({}));
  const increment =
    typeof body.increment === "number" &&
    Number.isFinite(body.increment) &&
    body.increment > 0
      ? Math.floor(body.increment)
      : 1;

  const habit = await prisma.habit.findFirst({
    where: { id, userId: user.id },
  });

  if (!habit) {
    return notFound();
  }

  // Data local do usuário como chave de dia (meia-noite UTC do dia local).
  const now = new Date();
  const userNow = new Date(now.getTime() - tzOffset * 60_000);
  const dayStartMs = Date.UTC(
    userNow.getUTCFullYear(),
    userNow.getUTCMonth(),
    userNow.getUTCDate(),
  );
  const date = new Date(dayStartMs);
  const weekStartMs = dayStartMs - userNow.getUTCDay() * 86_400_000;

  // Hábitos bons diários só aceitam marcação nos dias agendados; ruins valem
  // todo dia e semanais podem ser marcados em qualquer dia da semana.
  if (habit.type !== "bad" && habit.frequency !== "weekly") {
    const daysOfWeek = parseDaysOfWeek(habit.daysOfWeek);
    if (!daysOfWeek.includes(userNow.getUTCDay())) {
      return badRequest("Habit not scheduled for today");
    }
  }

  // Ruim: marcações são recaídas — não saturam em targetCount.
  const isBad = habit.type === "bad";

  // Tudo atômico: upsert + XP + cascata de conexões + avaliação de conquistas
  // na MESMA transação (nada fica meio-aplicado se algo falhar).
  const { completion, periodCount, newlyUnlocked } = await prisma.$transaction(
    async (tx) => {      let row = await tx.habitCompletion.upsert({
        where: {
          habitId_date: {
            habitId: habit.id,
            date,
          },
        },
        create: {
          habitId: habit.id,
          userId: user.id,
          date,
          count: increment,
        },
        update: {
          count: { increment },
        },
      });

      // Bons hábitos: cliques repetidos não devem ultrapassar a meta.
      if (!isBad && row.count > habit.targetCount) {
        row = await tx.habitCompletion.update({
          where: { id: row.id },
          data: { count: habit.targetCount },
        });
      }

      // Diário: conta só hoje; semanal: soma a semana corrente.
      const periodStart =
        habit.frequency === "weekly" ? new Date(weekStartMs) : date;
      const aggregated = await tx.habitCompletion.aggregate({
        _sum: { count: true },
        where: {
          habitId: habit.id,
          date: { gte: periodStart, lte: date },
        },
      });
      const currentPeriodCount = aggregated._sum.count ?? 0;

      const dayKeyMs = date.getTime();
      if (isBad) {
        // Ruim: marcação = recaída, penalidade de XP (idempotente por dia).
        await awardXpOnce(
          tx,
          user.id,
          "habit.slip",
          XP_AMOUNTS.habitSlip,
          xpRefKeys.habitSlip(habit.id, dayKeyMs),
        );
      } else {
        await awardXpOnce(
          tx,
          user.id,
          "habit.confirm",
          XP_AMOUNTS.habitConfirm,
          xpRefKeys.habitConfirm(habit.id, dayKeyMs),
        );
        // Bônus ao atingir a meta do período.
        const reachedTarget =
          habit.frequency === "weekly"
            ? currentPeriodCount >= habit.targetCount
            : row.count >= habit.targetCount;
        if (reachedTarget) {
          const windowStart =
            habit.frequency === "weekly"
              ? new Date(weekStartMs).getTime()
              : dayKeyMs;
          await awardXpOnce(
            tx,
            user.id,
            "habit.target",
            XP_AMOUNTS.habitTargetBonus,
            xpRefKeys.habitTarget(habit.id, windowStart),
          );
        }
        // Meta atingida auto-confirma os blocos conectados.
        await confirmBlocksForHabits(tx, user.id, [habit.id], tzOffset);
      }

      const stats = await loadGamificationStats(tx, user.id, tzOffset);
      const newlyUnlocked = await evaluateAchievements(tx, user.id, stats);

      return {
        completion: row,
        periodCount: currentPeriodCount,
        newlyUnlocked,
      };
    },
  );

  // Pushes de gamificação após o commit (conquistas + level up).
  await sendGamificationNotifications(user.id, {
    newlyUnlockedAchievements: newlyUnlocked,
  });

  return NextResponse.json({
    completion,
    isComplete: !isBad && completion.count >= habit.targetCount,
    periodCount,
    type: habit.type,
    gamification:
      newlyUnlocked.length > 0 ? { unlocked: newlyUnlocked } : undefined,
  });
}
/** Remove o registro de hoje (desfazer confirmação/recaída). */
export async function DELETE(request: Request, { params }: RouteParams) {
  const { user, response } = await requireUser();
  if (response) return response;

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const tzOffset = parseTzOffset(searchParams.get("tzOffset"));

  const habit = await prisma.habit.findFirst({
    where: { id, userId: user.id },
  });

  if (!habit) {
    return notFound();
  }

  const now = new Date();
  const userNow = new Date(now.getTime() - tzOffset * 60_000);
  const dayStartMs = Date.UTC(
    userNow.getUTCFullYear(),
    userNow.getUTCMonth(),
    userNow.getUTCDate(),
  );
  const date = new Date(dayStartMs);
  const weekStartMs = dayStartMs - userNow.getUTCDay() * 86_400_000;
  const isBad = habit.type === "bad";

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.habitCompletion.findUnique({
      where: { habitId_date: { habitId: habit.id, date } },
    });
    if (!existing) return { removed: false, newlyUnlocked: [] as string[] };

    await tx.habitCompletion.delete({ where: { id: existing.id } });

    // XP: remove confirmação/bônus ou penalidade do dia.
    await removeXpForRef(
      tx,
      user.id,
      isBad ? "habit.slip" : "habit.confirm",
      xpRefKeys[isBad ? "habitSlip" : "habitConfirm"](habit.id, dayStartMs),
    );
    if (!isBad) {
      const windowStart =
        habit.frequency === "weekly"
          ? new Date(weekStartMs).getTime()
          : dayStartMs;
      await removeXpForRef(
        tx,
        user.id,
        "habit.target",
        xpRefKeys.habitTarget(habit.id, windowStart),
      );
    }

    // O hábito pode ter originado auto-confirmações em blocos (meta atingida):
    // remove-as e reavalia as tarefas/sub-tarefas conectadas a esses blocos.
    const autos = await tx.timeBlockCompletion.findMany({
      where: { source: "auto", sourceEntityId: `habit:${habit.id}` },
      select: { timeBlockId: true, periodStart: true },
    });
    if (autos.length > 0) {
      await tx.timeBlockCompletion.deleteMany({
        where: {
          source: "auto",
          sourceEntityId: `habit:${habit.id}`,
        },
      });
      for (const timeBlockId of [
        ...new Set(autos.map((auto) => auto.timeBlockId)),
      ]) {
        await reversePropagateForBlock(tx, user.id, timeBlockId, tzOffset);
      }
    }

    // Se o hábito continua satisfeito via conexões (desfazer direto num dia
    // coberto por blocos confirmados), restaura a conclusão automática.
    if (!isBad) {
      await completeHabitsForConnections(tx, user.id, [habit.id], tzOffset);
    }

    const stats = await loadGamificationStats(tx, user.id, tzOffset);
    const newlyUnlocked = await evaluateAchievements(tx, user.id, stats);

    return { removed: true, newlyUnlocked };
  });

  // Pushes de gamificação após o commit.
  await sendGamificationNotifications(user.id, {
    newlyUnlockedAchievements: result.newlyUnlocked,
  });

  // Recalcula o total do período após remover o dia de hoje.
  const periodStart =
    habit.frequency === "weekly" ? new Date(weekStartMs) : date;
  const aggregated = await prisma.habitCompletion.aggregate({
    _sum: { count: true },
    where: {
      habitId: habit.id,
      date: { gte: periodStart, lte: date },
    },
  });

  return NextResponse.json({
    ok: true,
    removed: result.removed,
    periodCount: aggregated._sum.count ?? 0,
    type: habit.type,
  });
}