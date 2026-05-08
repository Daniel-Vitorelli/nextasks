"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import LogoGrande from "@/public/logo_grande.png";
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
import { createLoginSchema } from "@/schemas/login-schema";
import GoogleSvg from "@/components/svg/GoogleSvg";
import MicrosoftSvg from "@/components/svg/MicrosoftSvg";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const t = useTranslations("login");

  const loginSchema = useMemo(() => createLoginSchema(t), [t]);

  const {
    register,
    handleSubmit,
    setError,
    resetField,
    formState: { errors, isSubmitted, touchedFields, isSubmitting },
  } = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    mode: "onChange",
  });

  const login = async (data: z.infer<typeof loginSchema>) => {
    const {} = await authClient.signIn.email({
      email: data.email,
      password: data.pwd,
      callbackURL: "/dashboard"
    }, {
      onError: (ctx) => {
        if(ctx.error.code === "INVALID_EMAIL_OR_PASSWORD"){
          setError("email", {
            message: ctx.error.message
          })
          resetField("pwd")
        }
      }
    })
  };

  const showError = (field: keyof z.infer<typeof loginSchema>) => {
    return !!errors[field] && (touchedFields[field] || isSubmitted);
  };

  return (
    <section className="flex min-h-screen bg-zinc-50 px-4 py-16 md:py-32 dark:bg-transparent">
      <form
        onSubmit={handleSubmit(login)}
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
                id="email"
                {...register("email")}
                aria-invalid={showError("email")}
              />
              {showError("email") && (
                <FieldError>{errors.email!.message}</FieldError>
              )}
            </Field>

            <Field
              className="space-y-0.5 gap-0"
              data-invalid={showError("pwd")}
            >
              <div className="flex items-center justify-between">
                <FieldLabel
                  htmlFor="pwd"
                  className="text-sm font-jetbrainsMono"
                >
                  {t("password")}
                </FieldLabel>
                <Button asChild variant="link" size="sm">
                  <Link
                    href="#"
                    className="link intent-info variant-ghost text-sm font-jetbrainsMono"
                  >
                    {t("forget")}
                  </Link>
                </Button>
              </div>
              <Input
                type="password"
                aria-invalid={showError("pwd")}
                {...register("pwd")}
                id="pwd"
                className="input sz-md variant-mixed"
              />
              {showError("pwd") && (
                <FieldError>{errors.pwd!.message}</FieldError>
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
            <span className="text-muted-foreground text-xs">
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
            {t("dontAccount")}
            <Button asChild variant="link" className="px-2">
              <Link href="sign-up">{t("create")}</Link>
            </Button>
          </p>
        </div>
      </form>
    </section>
  );
}
