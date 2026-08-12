-- CreateTable
CREATE TABLE "ProjectAppearance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "colorTo" TEXT,
    "angle" INTEGER NOT NULL DEFAULT 160,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectAppearance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectAppearance_userId_idx" ON "ProjectAppearance"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectAppearance_userId_projectId_key" ON "ProjectAppearance"("userId", "projectId");

-- AddForeignKey
ALTER TABLE "ProjectAppearance" ADD CONSTRAINT "ProjectAppearance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAppearance" ADD CONSTRAINT "ProjectAppearance_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Фон проекта стал персональным: уже выбранный цвет проекта переносим
-- владельцу — он его и выбирал. Остальные участники увидят обычный фон темы.
INSERT INTO "ProjectAppearance" ("id", "userId", "projectId", "color", "updatedAt")
SELECT md5(random()::text || p."id"), p."ownerId", p."id", p."color", now()
FROM "Project" p
WHERE p."color" IS NOT NULL;

-- AlterTable
ALTER TABLE "Project" DROP COLUMN "color";
