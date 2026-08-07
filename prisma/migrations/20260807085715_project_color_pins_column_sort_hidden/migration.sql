-- CreateEnum
CREATE TYPE "ColumnSort" AS ENUM ('MANUAL', 'CREATED_DESC', 'CREATED_ASC');

-- AlterTable
ALTER TABLE "BoardColumn" ADD COLUMN     "hidden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sort" "ColumnSort" NOT NULL DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "color" TEXT;

-- CreateTable
CREATE TABLE "ProjectPin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectPin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectPin_userId_idx" ON "ProjectPin"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectPin_userId_projectId_key" ON "ProjectPin"("userId", "projectId");

-- AddForeignKey
ALTER TABLE "ProjectPin" ADD CONSTRAINT "ProjectPin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPin" ADD CONSTRAINT "ProjectPin_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
