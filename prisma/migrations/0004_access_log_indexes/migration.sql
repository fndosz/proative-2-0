-- CreateEnum
CREATE TYPE "AccessKind" AS ENUM ('PAGE', 'ACTION', 'API', 'AUTH', 'ERROR');

-- CreateTable
CREATE TABLE "AccessLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "kind" "AccessKind" NOT NULL,
    "path" TEXT NOT NULL,
    "name" TEXT,
    "status" INTEGER NOT NULL DEFAULT 200,
    "durationMs" INTEGER,
    "error" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccessLog_createdAt_idx" ON "AccessLog"("createdAt");

-- CreateIndex
CREATE INDEX "AccessLog_userId_createdAt_idx" ON "AccessLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AccessLog_kind_createdAt_idx" ON "AccessLog"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "AccessLog_path_createdAt_idx" ON "AccessLog"("path", "createdAt");

-- CreateIndex
CREATE INDEX "ActionItem_directorateId_idx" ON "ActionItem"("directorateId");

-- CreateIndex
CREATE INDEX "ActionItem_ownerId_idx" ON "ActionItem"("ownerId");

-- CreateIndex
CREATE INDEX "ActionItem_meetingId_idx" ON "ActionItem"("meetingId");

-- CreateIndex
CREATE INDEX "AuditEvent_actorId_createdAt_idx" ON "AuditEvent"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "Document_directorateId_updatedAt_idx" ON "Document"("directorateId", "updatedAt");

-- CreateIndex
CREATE INDEX "Meeting_date_idx" ON "Meeting"("date");

-- CreateIndex
CREATE INDEX "Meeting_directorateId_archivedAt_idx" ON "Meeting"("directorateId", "archivedAt");

