import type { Task } from "@/types/domain";

const DAY_MS = 86_400_000;

/**
 * Urgência da data limite (0–15): atrasada (10–15, cresce com o atraso),
 * vence hoje (8–10), até 3 dias (6–8), até 7 dias (4–6), até ~1 mês (0–4),
 * depois disso ou sem data (0). A tarefa só é atrasada após o fim do dia.
 */
export function dueUrgencyScore(
  dueDate: string | null,
  now = new Date(),
): number {
  if (!dueDate) return 0;

  const dueEnd = new Date(dueDate);
  dueEnd.setHours(23, 59, 59, 999);
  const daysUntil = (dueEnd.getTime() - now.getTime()) / DAY_MS;

  if (daysUntil <= 0) return 10 + Math.min(5, -daysUntil);
  if (daysUntil <= 1) return 8 + (1 - daysUntil) * 2;
  if (daysUntil <= 3) return 6 + (3 - daysUntil);
  if (daysUntil <= 7) return 4 + ((7 - daysUntil) / 4) * 2;
  if (daysUntil <= 30) return 4 - ((daysUntil - 7) / 23) * 4;
  return 0;
}

/** Pontuação combinada de prioridade (1–6) e urgência da data limite. */
export function taskUrgencyScore(
  task: Pick<Task, "priority" | "dueDate">,
  now = new Date(),
): number {
  return dueUrgencyScore(task.dueDate, now) + task.priority;
}

/**
 * Ordena tarefas pendentes por urgência combinada (maior primeiro),
 * desempatando pela data limite mais próxima, prioridade e data de criação.
 */
export function sortPendingTasks<
  T extends Pick<Task, "priority" | "dueDate" | "createdAt">,
>(tasks: T[], now = new Date()): T[] {
  return [...tasks].sort((a, b) => {
    const scoreA = taskUrgencyScore(a, now);
    const scoreB = taskUrgencyScore(b, now);
    if (scoreB !== scoreA) return scoreB - scoreA;

    const dueA = a.dueDate
      ? new Date(a.dueDate).getTime()
      : Number.POSITIVE_INFINITY;
    const dueB = b.dueDate
      ? new Date(b.dueDate).getTime()
      : Number.POSITIVE_INFINITY;
    if (dueA !== dueB) return dueA - dueB;

    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

/**
 * Comparador da lista de tarefas do painel: concluídas no fim, depois maior
 * prioridade primeiro e, por fim, mais recentes primeiro.
 */
export function sortTasksForList(a: Task, b: Task): number {
  return (
    Number(a.done) - Number(b.done) ||
    b.priority - a.priority ||
    b.createdAt.localeCompare(a.createdAt)
  );
}