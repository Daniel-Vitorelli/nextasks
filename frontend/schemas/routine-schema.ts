import { useTranslations } from "next-intl";
import z from "zod";

import { DURATIONS, FREQUENCIES } from "@/lib/routines";

export const createRoutineSchema = (t: ReturnType<typeof useTranslations>) => {
  return z
    .object({
      name: z.string().trim().min(1, t("nameRequired")),
      description: z.string(),
      frequency: z.enum(FREQUENCIES),
      duration: z.enum(DURATIONS),
      endDate: z.string(),
    })
    .superRefine((data, ctx) => {
      if (data.duration === "until" && !data.endDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t("endDateRequired"),
          path: ["endDate"],
        });
      }
    });
};

export type RoutineSchema = ReturnType<typeof createRoutineSchema>;