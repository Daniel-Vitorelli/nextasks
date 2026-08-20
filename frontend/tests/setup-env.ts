import { TEST_DATABASE_URL } from "./helpers";

/**
 * Roda antes de cada arquivo de teste ser importado. Garante que o
 * PrismaClient de lib/server/prisma.ts seja construído apontando para o
 * banco de integração (app_test), e não para o banco de dev (app) ou para
 * nenhum valor vindo de .env — o hostname "mysql" do compose não resolve
 * fora da rede do Docker.
 */
process.env.DATABASE_URL = TEST_DATABASE_URL;