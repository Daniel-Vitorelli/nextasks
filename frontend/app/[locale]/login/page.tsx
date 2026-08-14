"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useForm } from "react-hook-form";
import z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { AuthCard } from "@/components/auth/auth-card";
import { useFieldErrors } from "@/hooks/use-field-errors";
import { createLoginSchema } from "@/schemas/login-schema";
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

  const showError = useFieldErrors<keyof z.infer<typeof loginSchema>>(
    errors,
    touchedFields,
    isSubmitted,
  );

  const login = async (data: z.infer<typeof loginSchema>) => {
    await authClient.signIn.email(
      {
        email: data.email,
        password: data.pwd,
        callbackURL: "/app/home",
      },
      {
        onError: (ctx) => {
          if (ctx.error.code === "INVALID_EMAIL_OR_PASSWORD") {
            setError("email", {
              message: ctx.error.message,
            });
            resetField("pwd");
          }
        },
      },
    );
  };

  return (
    <AuthCard
      title={t("title")}
      description={t("description")}
      continueLabel={t("continue")}
      onSubmit={handleSubmit(login)}
      footer={
        <p className="text-accent-foreground text-center text-sm font-jetbrainsMono">
          {t("dontAccount")}
          <Button asChild variant="link" className="px-2">
            <Link href="sign-up">{t("create")}</Link>
          </Button>
        </p>
      }
    >
      <FieldGroup className="mt-6 space-y-6 gap-0">
        <Field className="space-y-2 gap-0" data-invalid={showError("email")}>
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

        <Field className="space-y-0.5 gap-0" data-invalid={showError("pwd")}>
          <div className="flex items-center justify-between">
            <FieldLabel htmlFor="pwd" className="text-sm font-jetbrainsMono">
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
    </AuthCard>
  );
}
