import { redirect } from "next/navigation";
import { getUser } from "@/lib/server/session";
import { AppDock } from "@/components/app/app-dock";
import { NotificationStream } from "@/components/app/notification-toast";
import { SessionProvider } from "@/components/app/session-provider";
import { ConnectionsProvider } from "@/components/connections/connections-provider";
import { XpToast } from "@/components/app/gamification/xp-toast";
import type { ReactNode } from "react";


export default async function Layout({
  children,
}: {
  children: ReactNode
}) {
  const user = await getUser();

  if (!user) {
    redirect("/");
  }

  return (
    <SessionProvider initialUser={user}>
      <ConnectionsProvider>
        <div className="relative min-h-screen">
          <main className="pb-8">{children}</main>
          <XpToast />
          <NotificationStream />
          <AppDock />
        </div>
      </ConnectionsProvider>
    </SessionProvider>
  );
}