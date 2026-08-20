"use client";

import { useLocale, useTranslations } from "next-intl";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const LOCALE_LABELS: Record<string, string> = {
  pt: "Português",
  en: "English",
};

export function LocaleSwitcher() {
  const t = useTranslations("app.config.language");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <Select
      value={locale}
      onValueChange={(value) => {
        router.replace(pathname, { locale: value });
      }}
    >
      <SelectTrigger
        aria-label={t("selectLabel")}
        className="w-full"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {routing.locales.map((code) => (
          <SelectItem key={code} value={code}>
            {LOCALE_LABELS[code] ?? code}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}