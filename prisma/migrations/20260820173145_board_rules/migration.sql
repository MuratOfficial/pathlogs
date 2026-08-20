-- CreateTable
CREATE TABLE "BoardRule" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "columnId" TEXT NOT NULL,
    "setStatus" "TaskStatus",
    "assignUserId" TEXT,
    "addTagId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BoardRule_projectId_idx" ON "BoardRule"("projectId");

-- CreateIndex
CREATE INDEX "BoardRule_columnId_idx" ON "BoardRule"("columnId");

-- AddForeignKey
ALTER TABLE "BoardRule" ADD CONSTRAINT "BoardRule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardRule" ADD CONSTRAINT "BoardRule_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "BoardColumn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardRule" ADD CONSTRAINT "BoardRule_assignUserId_fkey" FOREIGN KEY ("assignUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardRule" ADD CONSTRAINT "BoardRule_addTagId_fkey" FOREIGN KEY ("addTagId") REFERENCES "Tag"("id") ON DELETE SET NULL ON UPDATE CASCADE;
