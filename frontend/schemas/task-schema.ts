import { useTranslations } from "next-intl";
import z from "zod";

import { TASK_PRIORITIES } from "@/types/domain";
import type { TaskFormValues } from "@/types/domain";

export const createTaskSchema = (
  t: ReturnType<typeof useTranslations>,
): z.ZodType<TaskFormValues, TaskFormValues> => {
  return z.object({
    title: z.string().trim().min(1, t("titleRequired")),
    description: z.string(),
    dueDate: z.string(),
    priority: z
      .number()
      .int()
      .min(TASK_PRIORITIES[0])
      .max(TASK_PRIORITIES[TASK_PRIORITIES.length - 1]),
  }) as unknown as z.ZodType<TaskFormValues, TaskFormValues>;
};