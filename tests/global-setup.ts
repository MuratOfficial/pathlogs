import { execSync } from "node:child_process";
import { TEST_DATABASE_URL } from "./test-db-url";

/** Создаёт/синхронизирует тестовую БД перед запуском тестов. */
export default function globalSetup() {
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "inherit",
  });
}
