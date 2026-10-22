-- AlterTable
ALTER TABLE "Minutes" ADD COLUMN     "aiCostCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "aiGeneratedAt" TIMESTAMP(3),
ADD COLUMN     "aiModel" TEXT,
ADD COLUMN     "transcript" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "transcriptUpdatedAt" TIMESTAMP(3);

