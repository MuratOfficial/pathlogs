-- AlterEnum
-- IF NOT EXISTS: локальные базы, куда тип уже попал через `prisma db push`,
-- применяют миграцию без ошибки.
ALTER TYPE "TaskType" ADD VALUE IF NOT EXISTS 'DEVELOPMENT';
