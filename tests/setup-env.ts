import { TEST_DATABASE_URL } from "./test-db-url";

// Должно выполниться до импорта prisma-клиента в тестовых модулях,
// чтобы singleton подключился к тестовой БД, а не к рабочей.
process.env.DATABASE_URL = TEST_DATABASE_URL;
