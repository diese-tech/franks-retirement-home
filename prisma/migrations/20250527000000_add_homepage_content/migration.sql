-- CreateTable
CREATE TABLE "HomepageContent" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "ticker" JSONB NOT NULL DEFAULT '[]',
    "headlines" JSONB NOT NULL DEFAULT '[]',
    "bulletin" JSONB NOT NULL DEFAULT '[]',
    "fraudWatch" JSONB NOT NULL DEFAULT '[]',
    "motw" JSONB NOT NULL DEFAULT '{}',
    "rivalries" JSONB NOT NULL DEFAULT '[]',
    "knowsBall" JSONB NOT NULL DEFAULT '[]',
    "washedReports" JSONB NOT NULL DEFAULT '[]',
    "socialCards" JSONB NOT NULL DEFAULT '[]',
    "discordInviteUrl" TEXT NOT NULL DEFAULT 'https://discord.gg/HPAZmHmBpD',
    "washedPct" INTEGER NOT NULL DEFAULT 88,
    "showTicker" BOOLEAN NOT NULL DEFAULT true,
    "showHeadlines" BOOLEAN NOT NULL DEFAULT true,
    "showBulletin" BOOLEAN NOT NULL DEFAULT true,
    "showFraudWatch" BOOLEAN NOT NULL DEFAULT true,
    "showMotw" BOOLEAN NOT NULL DEFAULT true,
    "showRivalries" BOOLEAN NOT NULL DEFAULT true,
    "showKnowsBall" BOOLEAN NOT NULL DEFAULT true,
    "showWashedReports" BOOLEAN NOT NULL DEFAULT true,
    "showSocialCards" BOOLEAN NOT NULL DEFAULT true,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "savedByAdminId" TEXT,

    CONSTRAINT "HomepageContent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HomepageContent_status_key" ON "HomepageContent"("status");

-- CreateIndex
CREATE INDEX "HomepageContent_status_idx" ON "HomepageContent"("status");
