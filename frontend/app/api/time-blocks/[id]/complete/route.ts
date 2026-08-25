import { NextResponse } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { periodForFrequency } from "@/lib/server/completions";
import {
  completeEntitiesForBlock,
  reversePropagateForBlock,
  revertAutoHabitCompletionsForBlock,
} from "@/lib/server/connections";
import {
  awardXpOnce,
  blockConfirmXp,
  removeXpForRef,
  syncRoutineDayFullXp,
  xpRefKeys,
} from "@/lib/server/gamification/xp";
import {
  evaluateAchievements,
} from "@/lib/server/gamification/service";
import { loadGamificationStats } from "@/lib/server/gamification/stats";
import {
  asFrequency,
  badRequest,
  notFound,
  parseTzOffset,
  requireUser,
  type RouteContext,
} from "@/lib/server/api";

export async function POST(
  request: Request,
  { params }: RouteContext<{ id: string }>,
) {
  const { user, response } = await requireUser();
  if (response) return response;

  const { id } = await params;
  const url = new URL(request.url);
  const tzOffsetMinutes = parseTzOffset(url.searchParams.get("tzOffset"));

  const timeBlock = await prisma.timeBlock.findFirst({
    where: { id, routine: { userId: user.id } },
    include: { routine: true },
  });
  if (!timeBlock) {
    return notFound("Time block not found");
  }

  const body = (await request.json().catch(() => ({}))) as { value?: unknown };

  if (typeof body.value !== "string") {
    return badRequest("Value is required");
  }

  let validValue: string;

  if (timeBlock.confirmation === "checklist") {
    if (body.value !== "true" && body.value !== "false") {
      return badRequest("Invalid value for checklist confirmation");
    }
    validValue = body.value;
  } else if (timeBlock.confirmation === "score") {
    const score = Number.parseInt(body.value, 10);
    if (Number.isNaN(score) || score < 1 || score > 10) {
      return badRequest("Invalid value for score confirmation");
    }
    validValue = String(score);
  } else {
    return badRequest("Block has no confirmation mode");
  }

  const period = periodForFrequency(
    asFrequency(timeBlock.routine.frequency),
    new Date(),
    tzOffsetMinutes,
  );

  // Gamificação: refKey idempotente por bloco+período evita farm de toggle;
  // desconfirmar remove o ganho correspondente.
  const xpRef = xpRefKeys.block(timeBlock.id, period.start.getTime());
  const xpAmount = blockConfirmXp(timeBlock.confirmation, validValue);

  const completion = await prisma.$transaction(async (tx) => {
    const saved = await tx.timeBlockCompletion.upsert({
      where: {
        timeBlockId_periodStart: {
          timeBlockId: timeBlock.id,
          periodStart: period.start,
        },
      },
      create: {
        timeBlockId: timeBlock.id,
        userId: user.id,
        periodStart: period.start,
        periodEnd: period.end,
        value: validValue,
        source: "explicit",
        sourceEntityId: null,
      },
      update: {
        value: validValue,
        source: "explicit",
        sourceEntityId: null,
      },
    });

    // Confirmação do usuário (mesmo que desmarque) é sempre decisão
    // explícita: converte auto-confirmações do período em explícitas.
    if (validValue === "false") {
      // Desmarcar propaga no sentido reverso: reavalia as entidades
      // conectadas e reabre as que ficaram com conexões insatisfeitas;
      // hábitos perdem apenas as conclusões automáticas do período.
      await reversePropagateForBlock(tx, user.id, timeBlock.id, tzOffsetMinutes);
      await revertAutoHabitCompletionsForBlock(
        tx,
        user.id,
        timeBlock.id,
        tzOffsetMinutes,
      );
      await removeXpForRef(tx, user.id, "block.confirm", xpRef);
    } else {
      // Bloco confirmado propaga para TODAS as entidades conectadas (tarefas,
      // sub-tarefas e hábitos bons) quando suas conexões estiverem satisfeitas.
      await completeEntitiesForBlock(
        tx,
        user.id,
        timeBlock.id,
        tzOffsetMinutes,
      );
      await awardXpOnce(tx, user.id, "block.confirm", xpAmount, xpRef);
    }

    // Dia 100% da rotina ativa: concede/remove conforme o estado atual.
    await syncRoutineDayFullXp(tx, user.id, tzOffsetMinutes);

    const stats = await loadGamificationStats(tx, user.id, tzOffsetMinutes);
    const newlyUnlocked = await evaluateAchievements(
      tx,
      user.id,
      stats,
    );

    return { saved, newlyUnlocked };
  });

  return NextResponse.json({
    completion: completion.saved,
    period,
    gamification:
      completion.newlyUnlocked.length > 0
        ? { unlocked: completion.newlyUnlocked }
        : undefined,
  });
}
