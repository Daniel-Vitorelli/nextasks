"use client"

import { Dock, DockIcon } from "@/components/ui/dock";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Bot, Cog, Home, LayoutDashboard, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

const items = [
  { labelKey: "social", icon: Users, href: "/app/social" },
  { labelKey: "dashboard", icon: LayoutDashboard, href: "/app/dashboard" },
  { labelKey: "home", icon: Home, href: "/app/home" },
  { labelKey: "ai", icon: Bot, href: "/app/ai" },
  { labelKey: "config", icon: Cog, href: "/app/config" },
];

export function AppDock() {
  const t = useTranslations("app.dock");

  return (
    <Dock
      direction="bottom"
      className="app-dock fixed bottom-4 left-1/2 -translate-x-1/2"
    >
      {items.map(({ labelKey, icon: Icon, href }) => (
        <DockIcon key={labelKey}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={href}
                className="flex h-full w-full items-center justify-center"
              >
                <Icon />
              </Link>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t(labelKey)}</p>
            </TooltipContent>
          </Tooltip>
        </DockIcon>
      ))}
    </Dock>
  );
}