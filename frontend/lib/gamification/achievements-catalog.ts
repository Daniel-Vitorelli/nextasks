import type { AchievementDef } from "@/types/domain";

/**
 * Catálogo de conquistas v1 — todas visíveis, baseadas em limiares de
 * estatísticas do snapshot (todas as condições devem ser satisfeitas).
 * Chaves de nome/descrição: app.gamification.achievements.<id>.name|description
 */

const A = (
  id: string,
  tier: AchievementDef["tier"],
  icon: string,
  conditions: { stat: string; target: number }[],
): AchievementDef => ({
  id,
  tier,
  icon,
  xpReward: { bronze: 50, silver: 100, gold: 250, platinum: 500 }[tier],
  conditions,
});

export const ACHIEVEMENTS: AchievementDef[] = [
  // Blocos de tempo
  A("first-block", "bronze", "CalendarCheck", [
    { stat: "blocksConfirmed", target: 1 },
  ]),
  A("block-10", "bronze", "Clock", [{ stat: "blocksConfirmed", target: 10 }]),
  A("block-50", "silver", "Clock", [{ stat: "blocksConfirmed", target: 50 }]),
  A("block-250", "gold", "Clock", [{ stat: "blocksConfirmed", target: 250 }]),
  A("perfect-day", "silver", "Sparkles", [{ stat: "days100", target: 1 }]),
  A("streak-week-full", "gold", "Flame", [
    { stat: "bestRoutineStreak", target: 7 },
  ]),

  // Tarefas e sub-tarefas
  A("first-task", "bronze", "CheckCircle2", [{ stat: "tasksDone", target: 1 }]),
  A("task-10", "bronze", "ListChecks", [{ stat: "tasksDone", target: 10 }]),
  A("task-50", "silver", "ListChecks", [{ stat: "tasksDone", target: 50 }]),
  A("architect", "silver", "Link2", [
    { stat: "activeConnections", target: 5 },
  ]),
  A("subtask-25", "bronze", "GitBranch", [
    { stat: "subtasksDone", target: 25 },
  ]),

  // Hábitos bons
  A("first-checkin", "bronze", "CheckCircle2", [
    { stat: "habitTargetDays", target: 1 },
  ]),
  A("checkin-7", "bronze", "ThumbsUp", [
    { stat: "habitTargetDays", target: 7 },
  ]),
  A("checkin-30", "silver", "Medal", [
    { stat: "habitTargetDays", target: 30 },
  ]),
  A("three-good-habits", "bronze", "Sprout", [
    { stat: "goodHabitsActive", target: 3 },
  ]),

  // Hábitos ruins
  A("clean-week", "silver", "Shield", [{ stat: "bestCleanStreak", target: 7 }]),
  A("clean-month", "gold", "Shield", [{ stat: "bestCleanStreak", target: 30 }]),
  A("battling-two", "bronze", "Swords", [
    { stat: "badHabitsActive", target: 2 },
  ]),
  A("resilience", "gold", "HeartPulse", [
    { stat: "relapsesLogged", target: 1 },
    { stat: "bestCleanStreak", target: 7 },
  ]),

  // Metas e níveis
  A("xp-1000", "bronze", "Coins", [{ stat: "totalXp", target: 1000 }]),
  A("xp-10000", "gold", "Gem", [{ stat: "totalXp", target: 10000 }]),
  A("level-5", "bronze", "TrendingUp", [{ stat: "level", target: 5 }]),
  A("level-10", "silver", "Rocket", [{ stat: "level", target: 10 }]),
  A("level-15", "gold", "Rocket", [{ stat: "level", target: 15 }]),
  A("level-25", "platinum", "Crown", [{ stat: "level", target: 25 }]),

  // Conexões
  A("first-link", "bronze", "Link2", [
    { stat: "activeConnections", target: 1 },
  ]),
  A("link-10", "silver", "Link2", [{ stat: "activeConnections", target: 10 }]),

  // Excelência
  A("perfect-10", "gold", "Target", [{ stat: "perfect10", target: 10 }]),
  A("perfect-50", "platinum", "Target", [{ stat: "perfect10", target: 50 }]),
  A("task-100", "platinum", "ListChecks", [
    { stat: "tasksDone", target: 100 },
  ]),
  A("subtask-100", "gold", "GitBranch", [
    { stat: "subtasksDone", target: 100 },
  ]),
  A("checkin-100", "platinum", "Medal", [
    { stat: "habitTargetDays", target: 100 },
  ]),
  A("clean-90", "platinum", "ShieldCheck", [
    { stat: "bestCleanStreak", target: 90 },
  ]),

  // Longo prazo
  A("block-500", "platinum", "CalendarCheck", [
    { stat: "blocksConfirmed", target: 500 },
  ]),
  A("perfect-days-50", "gold", "Sparkles", [{ stat: "days100", target: 50 }]),
  A("streak-month-full", "platinum", "Flame", [
    { stat: "bestRoutineStreak", target: 30 },
  ]),
  A("link-25", "gold", "Link2", [{ stat: "activeConnections", target: 25 }]),
  A("five-good-habits", "silver", "Sprout", [
    { stat: "goodHabitsActive", target: 5 },
  ]),
  A("checkin-500", "platinum", "Medal", [
    { stat: "habitTargetDays", target: 500 },
  ]),
  A("clean-60", "gold", "ShieldCheck", [
    { stat: "bestCleanStreak", target: 60 },
  ]),
  A("level-20", "gold", "Rocket", [{ stat: "level", target: 20 }]),
  A("level-40", "platinum", "Crown", [{ stat: "level", target: 40 }]),
  A("xp-50000", "platinum", "Gem", [{ stat: "totalXp", target: 50000 }]),
];

/** Busca uma definição por id (null se não existir). */
export function achievementById(
  id: string,
): AchievementDef | undefined {
  return ACHIEVEMENTS.find((achievement) => achievement.id === id);
}
