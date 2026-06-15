import { execSync } from "node:child_process";
import { TEST_DATABASE_URL } from "./test-db-url";

/** Создаёт/синхронизирует тестовую БД перед запуском тестов. */
export default function globalSetup() {
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    // directUrl схемы читает DATABASE_URL_UNPOOLED — указываем ту же тестовую БД,
    // иначе db push уйдёт в dev-базу из .env.
    env: {
      ...process.env,
      DATABASE_URL: TEST_DATABASE_URL,
      DATABASE_URL_UNPOOLED: TEST_DATABASE_URL,
    },
    stdio: "inherit",
  });
}
