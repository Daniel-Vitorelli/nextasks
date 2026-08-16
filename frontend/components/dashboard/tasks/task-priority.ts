import type { TaskPriority } from "@/types/domain";

/** Tailwind classes for each priority level (1 = lowest, 6 = highest). */
export const priorityBadgeStyles: Record<TaskPriority, string> = {
  1: "bg-muted text-muted-foreground",
  2: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  3: "bg-green-500/10 text-green-600 dark:text-green-400",
  4: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  5: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  6: "bg-red-500/10 text-red-600 dark:text-red-400",
};

export const priorityDotStyles: Record<TaskPriority, string> = {
  1: "bg-muted-foreground",
  2: "bg-blue-500",
  3: "bg-green-500",
  4: "bg-yellow-500",
  5: "bg-orange-500",
  6: "bg-red-500",
};