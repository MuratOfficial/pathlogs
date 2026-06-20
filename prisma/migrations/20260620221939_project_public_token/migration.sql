-- Публичная read-only ссылка на роадмап проекта
ALTER TABLE "Project" ADD COLUMN "publicToken" TEXT;
CREATE UNIQUE INDEX "Project_publicToken_key" ON "Project"("publicToken");
