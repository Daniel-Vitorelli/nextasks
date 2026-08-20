import { headers } from "next/headers";

import { auth } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";

export async function getUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const user = session?.user ?? null;
  if (!user) return null;

  // Colunas customizadas (timezoneOffset) podem não vir na sessão do
  // better-auth: completa o perfil com o registro do banco.
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { timezoneOffset: true },
  });
  return { ...user, timezoneOffset: dbUser?.timezoneOffset ?? null };
}