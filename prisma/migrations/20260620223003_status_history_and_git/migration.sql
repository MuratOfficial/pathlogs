-- Машина времени: история смены статусов задачи
CREATE TABLE "TaskStatusEvent" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT,
    "fromStatus" "TaskStatus",
    "toStatus" "TaskStatus" NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskStatusEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TaskStatusEvent_taskId_at_idx" ON "TaskStatusEvent"("taskId", "at");
ALTER TABLE "TaskStatusEvent" ADD CONSTRAINT "TaskStatusEvent_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskStatusEvent" ADD CONSTRAINT "TaskStatusEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Глубокий git: расширение GitCommitRef
ALTER TABLE "GitCommitRef" ADD COLUMN "message" TEXT;
ALTER TABLE "GitCommitRef" ADD COLUMN "url" TEXT;
ALTER TABLE "GitCommitRef" ADD COLUMN "author" TEXT;
ALTER TABLE "GitCommitRef" ADD COLUMN "filesChanged" INTEGER;
ALTER TABLE "GitCommitRef" ADD COLUMN "committedAt" TIMESTAMP(3);
ALTER TABLE "GitCommitRef" ADD CONSTRAINT "GitCommitRef_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
