-- CreateTable
CREATE TABLE "IntakeForm" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Оставить заявку',
    "hint" TEXT,
    "columnId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntakeForm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IntakeForm_projectId_key" ON "IntakeForm"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "IntakeForm_token_key" ON "IntakeForm"("token");

-- AddForeignKey
ALTER TABLE "IntakeForm" ADD CONSTRAINT "IntakeForm_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeForm" ADD CONSTRAINT "IntakeForm_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "BoardColumn"("id") ON DELETE SET NULL ON UPDATE CASCADE;
