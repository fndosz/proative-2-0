-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "directorateId" TEXT,
    "participants" TEXT,
    "body" TEXT NOT NULL,
    "tags" TEXT[],
    "meetingId" TEXT,
    "createdById" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Note_date_idx" ON "Note"("date");

-- CreateIndex
CREATE INDEX "Note_directorateId_archivedAt_idx" ON "Note"("directorateId", "archivedAt");

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_directorateId_fkey" FOREIGN KEY ("directorateId") REFERENCES "Directorate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

