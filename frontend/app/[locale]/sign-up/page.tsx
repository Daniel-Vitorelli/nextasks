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
import { createSignUpSchema } from "@/schemas/sign-up-schema";
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

  const showError = useFieldErrors<keyof z.infer<typeof signUpSchema>>(
    errors,
    touchedFields,
    isSubmitted,
  );

  const signUp = async (data: z.infer<typeof signUpSchema>) => {
    await authClient.signUp.email(
      {
        email: data.email,
        name: data.name,
        password: data.pwd,
        callbackURL: "/app/home",
      },
      {
        onSuccess: () => {
          window.location.href = "/app/home";
        },
        onError: (ctx) => {
          if (ctx.error.code === "USER_ALREADY_EXISTS") {
            setError("email", {
              message: t("alreadyExists"),
            });
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
      onSubmit={handleSubmit(signUp)}
      footer={
        <p className="text-accent-foreground text-center text-sm font-jetbrainsMono">
          {t("haveAccount")}
          <Button asChild variant="link" className="px-2">
            <Link href="login">{t("signIn")}</Link>
          </Button>
        </p>
      }
    >
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

        <Field className="space-y-2 gap-0" data-invalid={showError("email")}>
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
    </AuthCard>
  );
}
