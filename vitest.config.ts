import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    globalSetup: "./tests/global-setup.ts",
    setupFiles: ["./tests/setup-env.ts"],
    // Тесты ходят в общую тестовую БД — параллелизм файлов отключён
    fileParallelism: false,
    testTimeout: 15000,
  },
});
