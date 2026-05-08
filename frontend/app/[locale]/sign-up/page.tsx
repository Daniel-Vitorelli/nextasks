"use client";

import LogoGrande from "@/public/logo_grande.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "next-intl";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { useForm } from "react-hook-form";
import z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo } from "react";
import { Spinner } from "@/components/ui/spinner";
import { createSignUpSchema } from "@/schemas/sign-up-schema";
import GoogleSvg from "@/components/svg/GoogleSvg";
import MicrosoftSvg from "@/components/svg/MicrosoftSvg";
import { authClient } from "@/lib/auth-client";

export default function SignUpPage() {
  const t = useTranslations("sign-up");

  const signUpSchema = useMemo(() => createSignUpSchema(t), [t]);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitted, touchedFields, isSubmitting },
  } = useForm<z.infer<typeof signUpSchema>>({
    resolver: zodResolver(signUpSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
  });

  const signUp = async (data: z.infer<typeof signUpSchema>) => {
    const {} = await authClient.signUp.email(
      {
        email: data.email,
        name: data.name,
        password: data.pwd,
        callbackURL: "/dashboard"
      },
      {
        onError: (ctx) => {
          if (ctx.error.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL") {
            setError("email", {
              message: t("alreadyExists"),
            });
          }
        },
      },
    );
  };

  const showError = (field: keyof z.infer<typeof signUpSchema>) => {
    return !!errors[field] && (touchedFields[field] || isSubmitted);
  };

  return (
    <section className="flex min-h-screen bg-zinc-50 px-4 py-16 md:py-32 dark:bg-transparent">
      <form
        onSubmit={handleSubmit(signUp)}
        className="bg-muted m-auto h-fit w-full max-w-sm overflow-hidden rounded-[calc(var(--radius)+.125rem)] border shadow-md shadow-zinc-950/5 dark:[--color-muted:var(--color-zinc-900)]"
      >
        <div className="bg-card -m-px rounded-[calc(var(--radius)+.125rem)] border p-8 pb-6">
          <div className="text-center">
            <Link href="/" aria-label="go home" className="mx-auto block w-fit">
              <Image
                src={LogoGrande}
                alt="NexTasks"
                height={48}
                className="filter invert-0 dark:invert"
              />
            </Link>
            <h1 className="mb-1 mt-4 text-xl font-semibold">{t("title")}</h1>
            <p className="text-sm">{t("description")}</p>
          </div>

          <FieldGroup className="mt-6 space-y-6 gap-0">
            <Field className="space-y-2 gap-0" data-invalid={showError("name")}>
              <FieldLabel
                htmlFor="name"
                className="block text-sm font-jetbrainsMono"
              >
                {t("name")}
              </FieldLabel>
              <Input
                type="text"
                id="name"
                {...register("name")}
                aria-invalid={showError("name")}
              />
              {showError("name") && (
                <FieldError>{errors.name!.message}</FieldError>
              )}
            </Field>

            <Field
              className="space-y-2 gap-0"
              data-invalid={showError("email")}
            >
              <FieldLabel
                htmlFor="email"
                className="block text-sm font-jetbrainsMono"
              >
                Email
              </FieldLabel>
              <Input
                type="email"
                {...register("email")}
                id="email"
                placeholder={t("exemple")}
                aria-invalid={showError("email")}
              />
              {showError("email") && (
                <FieldError>{errors.email!.message}</FieldError>
              )}
            </Field>

            <Field className="space-y-2 gap-0" data-invalid={showError("pwd")}>
              <FieldLabel
                htmlFor="pwd"
                className="block text-sm font-jetbrainsMono"
              >
                {t("password")}
              </FieldLabel>
              <Input
                type="password"
                {...register("pwd")}
                id="pwd"
                placeholder={t("characters")}
                aria-invalid={showError("pwd")}
              />
              {showError("pwd") && (
                <FieldError>{errors.pwd!.message}</FieldError>
              )}
            </Field>

            <Field
              className="space-y-2 gap-0"
              data-invalid={showError("confirmPwd")}
            >
              <FieldLabel
                htmlFor="confirmPwd"
                className="block text-sm font-jetbrainsMono"
              >
                {t("confirmPassword")}
              </FieldLabel>
              <Input
                type="password"
                {...register("confirmPwd")}
                id="confirmPwd"
                placeholder={t("characters")}
                aria-invalid={showError("confirmPwd")}
              />
              {showError("confirmPwd") && (
                <FieldError>{errors.confirmPwd!.message}</FieldError>
              )}
            </Field>

            <Button
              className="w-full font-jetbrainsMono"
              type="submit"
              variant={isSubmitting ? "outline" : "default"}
              disabled={isSubmitting}
            >
              {isSubmitting ? <Spinner /> : t("signIn")}
            </Button>
          </FieldGroup>

          <div className="my-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <hr className="border-dashed" />
            <span className="text-muted-foreground text-xs font-jetbrainsMono">
              {t("continue")}
            </span>
            <hr className="border-dashed" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button type="button" variant="outline">
              <GoogleSvg />
              <span>Google</span>
            </Button>
            <Button type="button" variant="outline">
              <MicrosoftSvg />
              <span>Microsoft</span>
            </Button>
          </div>
        </div>

        <div className="p-3">
          <p className="text-accent-foreground text-center text-sm font-jetbrainsMono">
            {t("haveAccount")}
            <Button asChild variant="link" className="px-2">
              <Link href="login">{t("signIn")}</Link>
            </Button>
          </p>
        </div>
      </form>
    </section>
  );
}
