import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { AppDock } from "@/components/app-dock";
import { SessionProvider } from "@/components/session-provider";
import type { ReactNode } from "react";


export default async function Layout({
  children,
}: {
  children: ReactNode
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/");
  }

  return (
    <SessionProvider value={{ user: session.user }}>
      <div className="relative min-h-screen">
        <main>{children}</main>
        <AppDock />
      </div>
    </SessionProvider>
  );
}