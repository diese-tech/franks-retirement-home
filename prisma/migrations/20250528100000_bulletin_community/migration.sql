-- Bulletin community engagement: reactions and comments on bulletin posts.
-- Additive only. Identity is the Discord ID (opaque string); no User FK required.

-- CreateTable
CREATE TABLE "BulletinReaction" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "discordId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BulletinReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BulletinComment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "discordId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BulletinComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BulletinReaction_postId_idx" ON "BulletinReaction"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "BulletinReaction_postId_discordId_emoji_key" ON "BulletinReaction"("postId", "discordId", "emoji");

-- CreateIndex
CREATE INDEX "BulletinComment_postId_idx" ON "BulletinComment"("postId");

-- AddForeignKey
ALTER TABLE "BulletinReaction" ADD CONSTRAINT "BulletinReaction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "BulletinPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulletinComment" ADD CONSTRAINT "BulletinComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "BulletinPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
