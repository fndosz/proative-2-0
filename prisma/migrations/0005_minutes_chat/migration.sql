-- CreateEnum
CREATE TYPE "ChatRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateTable
CREATE TABLE "MinutesMessage" (
    "id" TEXT NOT NULL,
    "minutesId" TEXT NOT NULL,
    "role" "ChatRole" NOT NULL,
    "content" TEXT NOT NULL,
    "operations" JSONB,
    "costCents" INTEGER NOT NULL DEFAULT 0,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MinutesMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MinutesMessage_minutesId_createdAt_idx" ON "MinutesMessage"("minutesId", "createdAt");

-- AddForeignKey
ALTER TABLE "MinutesMessage" ADD CONSTRAINT "MinutesMessage_minutesId_fkey" FOREIGN KEY ("minutesId") REFERENCES "Minutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

