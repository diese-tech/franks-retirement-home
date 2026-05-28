-- Weekly Superlatives: beer-league community awards. Additive only.

-- CreateTable
CREATE TABLE "Superlative" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "nominee" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "weekLabel" TEXT,
    "displayOrder" INTEGER,
    "createdById" TEXT,
    "suggestedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Superlative_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Superlative_status_idx" ON "Superlative"("status");
