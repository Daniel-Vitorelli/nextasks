"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";

import LogoGrande from "@/public/logo_grande.png";
import { Button } from "@/components/ui/button";
import GoogleSvg from "@/components/svg/GoogleSvg";
import MicrosoftSvg from "@/components/svg/MicrosoftSvg";

interface AuthCardProps {
  /** Page title shown under the logo */
  title: string;
  /** Description shown under the title */
  description: string;
  /** "Continue with" divider label */
  continueLabel: string;
  /** Footer content (e.g. "Don't have an account? Sign up") */
  footer: React.ReactNode;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  children: React.ReactNode;
}

/**
 * Shared card layout for the login/sign-up pages: logo, title, description,
 * form fields, social buttons and footer.
 */
export function AuthCard({
  title,
  description,
  continueLabel,
  footer,
  onSubmit,
  children,
}: AuthCardProps) {
  const t = useTranslations("home.hero");

  return (
    <section className="flex min-h-screen bg-zinc-50 px-4 py-16 md:py-32 dark:bg-transparent">
      <form
        onSubmit={onSubmit}
        className="bg-muted m-auto h-fit w-full max-w-sm overflow-hidden rounded-[calc(var(--radius)+.125rem)] border shadow-md shadow-zinc-950/5 dark:[--color-muted:var(--color-zinc-900)]"
      >
        <div className="bg-card -m-px rounded-[calc(var(--radius)+.125rem)] border p-8 pb-6">
          <div className="text-center">
            <Link href="/" aria-label={t("homeAria")} className="mx-auto block w-fit">
              <Image
                src={LogoGrande}
                alt="NexTasks"
                height={48}
                className="filter invert-0 dark:invert"
              />
            </Link>
            <h1 className="mb-1 mt-4 text-xl font-semibold">{title}</h1>
            <p className="text-sm">{description}</p>
          </div>

          {children}

          <div className="my-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <hr className="border-dashed" />
            <span className="text-muted-foreground text-xs font-jetbrainsMono">
              {continueLabel}
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

        <div className="p-3">{footer}</div>
      </form>
    </section>
  );
}
