import { useTranslations } from "next-intl";
import z from "zod";

import { EVENT_COLORS } from "@/lib/calendar/event-constants";
import {
  HABIT_FREQUENCIES,
  HABIT_KINDS,
} from "@/lib/validation/habits";

export const createHabitSchema = (t: ReturnType<typeof useTranslations>) => {
  return z
    .object({
      name: z.string().trim().min(1, t("nameRequired")),
      description: z.string(),
      icon: z.string().min(1, t("iconRequired")),
      color: z.enum(EVENT_COLORS),
      type: z.enum(HABIT_KINDS),
      frequency: z.enum(HABIT_FREQUENCIES),
      daysOfWeek: z.array(z.number().int().min(0).max(6)),
      targetCount: z.number().int().min(1, t("targetCountRequired")),
    })
    .superRefine((data, ctx) => {
      // Ruins são rastreados todos os dias: sem agenda nem meta.
      if (
        data.type === "good" &&
        data.frequency === "daily" &&
        data.daysOfWeek.length === 0
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t("daysRequired"),
          path: ["daysOfWeek"],
        });
      }
    });
};