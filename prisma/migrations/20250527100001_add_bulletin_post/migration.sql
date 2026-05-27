-- CreateTable
CREATE TABLE "BulletinPost" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "type" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "excerpt" TEXT,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "relatedPlayerId" TEXT,
    "relatedTeamId" TEXT,
    "relatedMatchId" TEXT,
    "relatedDivisionId" TEXT,
    "relatedSeasonId" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BulletinPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BulletinPost_slug_key" ON "BulletinPost"("slug");

-- CreateIndex
CREATE INDEX "BulletinPost_status_idx" ON "BulletinPost"("status");

-- CreateIndex
CREATE INDEX "BulletinPost_type_idx" ON "BulletinPost"("type");

-- CreateIndex
CREATE INDEX "BulletinPost_publishedAt_idx" ON "BulletinPost"("publishedAt");

-- AddForeignKey
ALTER TABLE "BulletinPost" ADD CONSTRAINT "BulletinPost_relatedPlayerId_fkey" FOREIGN KEY ("relatedPlayerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulletinPost" ADD CONSTRAINT "BulletinPost_relatedTeamId_fkey" FOREIGN KEY ("relatedTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulletinPost" ADD CONSTRAINT "BulletinPost_relatedMatchId_fkey" FOREIGN KEY ("relatedMatchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulletinPost" ADD CONSTRAINT "BulletinPost_relatedDivisionId_fkey" FOREIGN KEY ("relatedDivisionId") REFERENCES "Division"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulletinPost" ADD CONSTRAINT "BulletinPost_relatedSeasonId_fkey" FOREIGN KEY ("relatedSeasonId") REFERENCES "Season"("id") ON DELETE SET NULL ON UPDATE CASCADE;
