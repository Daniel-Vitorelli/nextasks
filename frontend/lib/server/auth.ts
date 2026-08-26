import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/server/prisma";

/**
 * Origens adicionais confiáveis além de BETTER_AUTH_URL (ex.: acesso por IP
 * da rede local de outros dispositivos). Formato: lista separada por vírgula,
 * ex.: TRUSTED_ORIGINS=http://192.168.0.149:3000,https://nextasks.meu-domino.com
 */
const trustedOrigins = (process.env.TRUSTED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "mysql",
  }),
  emailAndPassword: {
    enabled: true,
  },
  ...(trustedOrigins.length > 0 ? { trustedOrigins } : {}),
});
