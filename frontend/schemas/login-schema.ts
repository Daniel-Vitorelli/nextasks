import { useTranslations } from "next-intl";
import z from "zod";

export const createLoginSchema = (t: ReturnType<typeof useTranslations>) => {
  return z.object({
    email: z.email(t("invalidEmail")),
    pwd: z.string().min(8, t("characters")),
  });
};