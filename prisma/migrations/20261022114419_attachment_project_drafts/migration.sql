-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN     "projectId" TEXT;

-- CreateIndex
CREATE INDEX "Attachment_projectId_taskId_idx" ON "Attachment"("projectId", "taskId");

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
