-- Migration: frh_db_foundation
-- Adds: User, PlayerClaim, RosterImport, RosterImportRow, BulletinPost,
--       HomepageSectionConfig, EditorialCase, Wallet, WalletTransaction,
--       BettingLine, Bet
-- Alters: Player (adds discordId, avatarUrl, claimedByUserId)

-- ─── Player: new identity fields ─────────────────────────────────────────────
ALTER TABLE "Player" ADD COLUMN IF NOT EXISTS "discordId" TEXT;
ALTER TABLE "Player" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;
ALTER TABLE "Player" ADD COLUMN IF NOT EXISTS "claimedByUserId" TEXT;

-- ─── User ─────────────────────────────────────────────────────────────────────
CREATE TABLE "User" (
    "id"        TEXT         NOT NULL,
    "discordId" TEXT         NOT NULL,
    "username"  TEXT         NOT NULL,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_discordId_key" ON "User"("discordId");

-- FK: Player.claimedByUserId -> User.id
ALTER TABLE "Player" ADD CONSTRAINT "Player_claimedByUserId_fkey"
    FOREIGN KEY ("claimedByUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── PlayerClaim ──────────────────────────────────────────────────────────────
CREATE TABLE "PlayerClaim" (
    "id"           TEXT         NOT NULL,
    "userId"       TEXT         NOT NULL,
    "playerId"     TEXT         NOT NULL,
    "status"       TEXT         NOT NULL DEFAULT 'pending',
    "requestedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt"   TIMESTAMP(3),
    "reviewedById" TEXT,
    "note"         TEXT,
    CONSTRAINT "PlayerClaim_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PlayerClaim_userId_idx"   ON "PlayerClaim"("userId");
CREATE INDEX "PlayerClaim_playerId_idx" ON "PlayerClaim"("playerId");
CREATE INDEX "PlayerClaim_status_idx"   ON "PlayerClaim"("status");
ALTER TABLE "PlayerClaim" ADD CONSTRAINT "PlayerClaim_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlayerClaim" ADD CONSTRAINT "PlayerClaim_playerId_fkey"
    FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlayerClaim" ADD CONSTRAINT "PlayerClaim_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── RosterImport ─────────────────────────────────────────────────────────────
CREATE TABLE "RosterImport" (
    "id"            TEXT         NOT NULL,
    "seasonId"      TEXT,
    "status"        TEXT         NOT NULL DEFAULT 'staged',
    "rawFilename"   TEXT,
    "columnMapping" JSONB        NOT NULL DEFAULT '{}',
    "createdById"   TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importedAt"    TIMESTAMP(3),
    CONSTRAINT "RosterImport_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "RosterImport" ADD CONSTRAINT "RosterImport_seasonId_fkey"
    FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RosterImport" ADD CONSTRAINT "RosterImport_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── RosterImportRow ──────────────────────────────────────────────────────────
CREATE TABLE "RosterImportRow" (
    "id"             TEXT         NOT NULL,
    "importId"       TEXT         NOT NULL,
    "rowIndex"       INTEGER      NOT NULL,
    "rawData"        JSONB        NOT NULL,
    "normalizedData" JSONB,
    "status"         TEXT         NOT NULL DEFAULT 'pending',
    "errors"         JSONB,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RosterImportRow_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RosterImportRow_importId_idx" ON "RosterImportRow"("importId");
CREATE INDEX "RosterImportRow_status_idx"   ON "RosterImportRow"("status");
ALTER TABLE "RosterImportRow" ADD CONSTRAINT "RosterImportRow_importId_fkey"
    FOREIGN KEY ("importId") REFERENCES "RosterImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── BulletinPost ─────────────────────────────────────────────────────────────
CREATE TABLE "BulletinPost" (
    "id"                TEXT         NOT NULL,
    "title"             TEXT         NOT NULL,
    "slug"              TEXT         NOT NULL,
    "type"              TEXT         NOT NULL,
    "status"            TEXT         NOT NULL DEFAULT 'draft',
    "body"              TEXT         NOT NULL,
    "excerpt"           TEXT,
    "pinned"            BOOLEAN      NOT NULL DEFAULT false,
    "displayOrder"      INTEGER,
    "relatedPlayerId"   TEXT,
    "relatedTeamId"     TEXT,
    "relatedMatchId"    TEXT,
    "relatedDivisionId" TEXT,
    "relatedSeasonId"   TEXT,
    "createdById"       TEXT,
    "updatedById"       TEXT,
    "publishedAt"       TIMESTAMP(3),
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BulletinPost_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BulletinPost_slug_key"        ON "BulletinPost"("slug");
CREATE        INDEX "BulletinPost_status_idx"      ON "BulletinPost"("status");
CREATE        INDEX "BulletinPost_type_idx"        ON "BulletinPost"("type");
CREATE        INDEX "BulletinPost_publishedAt_idx" ON "BulletinPost"("publishedAt");
ALTER TABLE "BulletinPost" ADD CONSTRAINT "BulletinPost_relatedPlayerId_fkey"
    FOREIGN KEY ("relatedPlayerId")   REFERENCES "Player"("id")   ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BulletinPost" ADD CONSTRAINT "BulletinPost_relatedTeamId_fkey"
    FOREIGN KEY ("relatedTeamId")     REFERENCES "Team"("id")     ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BulletinPost" ADD CONSTRAINT "BulletinPost_relatedMatchId_fkey"
    FOREIGN KEY ("relatedMatchId")    REFERENCES "Match"("id")    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BulletinPost" ADD CONSTRAINT "BulletinPost_relatedDivisionId_fkey"
    FOREIGN KEY ("relatedDivisionId") REFERENCES "Division"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BulletinPost" ADD CONSTRAINT "BulletinPost_relatedSeasonId_fkey"
    FOREIGN KEY ("relatedSeasonId")   REFERENCES "Season"("id")   ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── HomepageSectionConfig ────────────────────────────────────────────────────
CREATE TABLE "HomepageSectionConfig" (
    "id"           TEXT         NOT NULL,
    "sectionKey"   TEXT         NOT NULL,
    "title"        TEXT,
    "subtitle"     TEXT,
    "statusText"   TEXT,
    "visible"      BOOLEAN      NOT NULL DEFAULT true,
    "displayOrder" INTEGER,
    "metadata"     JSONB,
    "updatedById"  TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HomepageSectionConfig_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HomepageSectionConfig_sectionKey_key" ON "HomepageSectionConfig"("sectionKey");

-- ─── EditorialCase ────────────────────────────────────────────────────────────
CREATE TABLE "EditorialCase" (
    "id"                TEXT         NOT NULL,
    "type"              TEXT         NOT NULL,
    "status"            TEXT         NOT NULL DEFAULT 'draft',
    "severity"          INTEGER,
    "title"             TEXT         NOT NULL,
    "charge"            TEXT,
    "body"              TEXT,
    "relatedPlayerId"   TEXT,
    "relatedTeamId"     TEXT,
    "relatedMatchId"    TEXT,
    "relatedDivisionId" TEXT,
    "relatedSeasonId"   TEXT,
    "signalSource"      JSONB,
    "createdById"       TEXT,
    "updatedById"       TEXT,
    "publishedAt"       TIMESTAMP(3),
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EditorialCase_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EditorialCase_type_idx"   ON "EditorialCase"("type");
CREATE INDEX "EditorialCase_status_idx" ON "EditorialCase"("status");
ALTER TABLE "EditorialCase" ADD CONSTRAINT "EditorialCase_relatedPlayerId_fkey"
    FOREIGN KEY ("relatedPlayerId")   REFERENCES "Player"("id")   ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EditorialCase" ADD CONSTRAINT "EditorialCase_relatedTeamId_fkey"
    FOREIGN KEY ("relatedTeamId")     REFERENCES "Team"("id")     ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EditorialCase" ADD CONSTRAINT "EditorialCase_relatedMatchId_fkey"
    FOREIGN KEY ("relatedMatchId")    REFERENCES "Match"("id")    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EditorialCase" ADD CONSTRAINT "EditorialCase_relatedDivisionId_fkey"
    FOREIGN KEY ("relatedDivisionId") REFERENCES "Division"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EditorialCase" ADD CONSTRAINT "EditorialCase_relatedSeasonId_fkey"
    FOREIGN KEY ("relatedSeasonId")   REFERENCES "Season"("id")   ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Wallet ───────────────────────────────────────────────────────────────────
CREATE TABLE "Wallet" (
    "id"        TEXT         NOT NULL,
    "userId"    TEXT         NOT NULL,
    "playerId"  TEXT,
    "balance"   INTEGER      NOT NULL DEFAULT 0,
    "status"    TEXT         NOT NULL DEFAULT 'unopened',
    "openedAt"  TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Wallet_userId_key"   ON "Wallet"("userId");
CREATE UNIQUE INDEX "Wallet_playerId_key" ON "Wallet"("playerId");
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey"
    FOREIGN KEY ("userId")   REFERENCES "User"("id")   ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_playerId_fkey"
    FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── WalletTransaction ────────────────────────────────────────────────────────
CREATE TABLE "WalletTransaction" (
    "id"           TEXT         NOT NULL,
    "walletId"     TEXT         NOT NULL,
    "type"         TEXT         NOT NULL,
    "amount"       INTEGER      NOT NULL,
    "balanceAfter" INTEGER      NOT NULL,
    "reason"       TEXT,
    "createdById"  TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WalletTransaction_walletId_idx" ON "WalletTransaction"("walletId");
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_walletId_fkey"
    FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── BettingLine ──────────────────────────────────────────────────────────────
CREATE TABLE "BettingLine" (
    "id"          TEXT         NOT NULL,
    "matchId"     TEXT         NOT NULL,
    "status"      TEXT         NOT NULL DEFAULT 'open',
    "teamAId"     TEXT         NOT NULL,
    "teamAOdds"   INTEGER      NOT NULL,
    "teamBId"     TEXT         NOT NULL,
    "teamBOdds"   INTEGER      NOT NULL,
    "closesAt"    TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    "settledAt"   TIMESTAMP(3),
    CONSTRAINT "BettingLine_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BettingLine_matchId_idx" ON "BettingLine"("matchId");
ALTER TABLE "BettingLine" ADD CONSTRAINT "BettingLine_matchId_fkey"
    FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BettingLine" ADD CONSTRAINT "BettingLine_teamAId_fkey"
    FOREIGN KEY ("teamAId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BettingLine" ADD CONSTRAINT "BettingLine_teamBId_fkey"
    FOREIGN KEY ("teamBId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── Bet ──────────────────────────────────────────────────────────────────────
CREATE TABLE "Bet" (
    "id"              TEXT         NOT NULL,
    "walletId"        TEXT         NOT NULL,
    "lineId"          TEXT         NOT NULL,
    "selectedTeamId"  TEXT         NOT NULL,
    "stake"           INTEGER      NOT NULL,
    "potentialPayout" INTEGER      NOT NULL,
    "status"          TEXT         NOT NULL DEFAULT 'pending',
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt"       TIMESTAMP(3),
    CONSTRAINT "Bet_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Bet_walletId_idx" ON "Bet"("walletId");
CREATE INDEX "Bet_lineId_idx"   ON "Bet"("lineId");
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_walletId_fkey"
    FOREIGN KEY ("walletId")       REFERENCES "Wallet"("id")      ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_lineId_fkey"
    FOREIGN KEY ("lineId")         REFERENCES "BettingLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_selectedTeamId_fkey"
    FOREIGN KEY ("selectedTeamId") REFERENCES "Team"("id")        ON DELETE RESTRICT ON UPDATE CASCADE;
