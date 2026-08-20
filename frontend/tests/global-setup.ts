import { execSync } from "node:child_process";
import { fileURLToPath, URL } from "node:url";
import { TEST_DATABASE_URL } from "./helpers";

const root = fileURLToPath(new URL("..", import.meta.url));

/**
 * Prepara o banco de integração ANTES de rodar os testes:
 * 1. cria o database app_test e concede privilégios ao app_user (via docker);
 * 2. aplica o schema atual (prisma db push) nesse database.
 * Requer o container `mysql` do docker-compose rodando.
 */
export default function globalSetup(): void {
  execSync(
    'docker exec mysql mysql -uroot -proot123 -e "CREATE DATABASE IF NOT EXISTS app_test; GRANT ALL PRIVILEGES ON app_test.* TO \'app_user\'@\'%\'; FLUSH PRIVILEGES;"',
    { stdio: "inherit" },
  );

  execSync(
    `npx prisma db push --force-reset --url "${TEST_DATABASE_URL}"`,
    {
      cwd: root,
      env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
      stdio: "inherit",
    },
  );
}