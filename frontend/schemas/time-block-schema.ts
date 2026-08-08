import { useTranslations } from "next-intl";
import z from "zod";

import { parseTimeInput } from "@/lib/time-blocks";

export const createTimeBlockSchema = (
  t: ReturnType<typeof useTranslations>,
) => {
  return z
    .object({
      title: z.string().trim().min(1, t("titleRequired")),
      startTime: z
        .string()
        .trim()
        .min(1, t("timeRequired"))
        .refine((value) => parseTimeInput(value) !== null, {
          message: t("invalidTime"),
        }),
      endTime: z
        .string()
        .trim()
        .min(1, t("timeRequired"))
        .refine((value) => parseTimeInput(value) !== null, {
          message: t("invalidTime"),
        }),
    })
    .superRefine((data, ctx) => {
      const start = parseTimeInput(data.startTime);
      const end = parseTimeInput(data.endTime);

      if (start && end) {
        const startTotal = start.hours * 60 + start.minutes;
        const endTotal = end.hours * 60 + end.minutes;

        if (endTotal <= startTotal) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: t("endBeforeStart"),
            path: ["endTime"],
          });
        }
      }
    });
};

export type TimeBlockFormValues = z.infer<
  ReturnType<typeof createTimeBlockSchema>
>;