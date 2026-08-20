import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": root,
    },
  },
  test: {
    globalSetup: ["./tests/global-setup.ts"],
    setupFiles: ["./tests/setup-env.ts"],
    // As suítes de integração compartilham o mesmo banco (app_test): os
    // arquivos precisam rodar em série para o resetDb de um não interromper
    // o outro.
    fileParallelism: false,
    include: ["tests/**/*.test.ts"],
    environment: "node",
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});