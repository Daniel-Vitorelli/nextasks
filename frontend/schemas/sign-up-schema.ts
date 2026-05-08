import z from "zod";
import { useTranslations } from "next-intl";

export const createSignUpSchema = (t: ReturnType<typeof useTranslations>) => {
  return z
    .object({
      name: z.string().transform((name) =>
        name
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .map(
            (word) =>
              word.charAt(0).toLocaleUpperCase() +
              word.slice(1).toLocaleLowerCase(),
          )
          .join(" "),
      ),
      email: z.email(t("invalidEmail")),
      pwd: z.string().min(8, t("characters")),
      confirmPwd: z.string(),
    })
    .refine((data) => data.pwd === data.confirmPwd, {
      message: t("notMatch"),
      path: ["confirmPwd"],
    });
};