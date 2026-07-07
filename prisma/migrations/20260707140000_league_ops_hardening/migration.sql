-- League ops hardening (issue #128):
--   * Indexes on the standings/schedule hot paths (Match, StatLine, Team).
--   * Unique fixture pairing on Match — one home/away pairing per week.
--     PRE-DEPLOY CHECK (run against prod before merging; this migration fails
--     if duplicate fixtures exist):
--       SELECT "seasonId","week","homeTeamId","awayTeamId",count(*)
--       FROM "Match" GROUP BY 1,2,3,4 HAVING count(*) > 1;
--   * BettingLine.winningTeamId — records the settled winner (issue #136).

-- AlterTable
ALTER TABLE "BettingLine" ADD COLUMN     "winningTeamId" TEXT;

-- CreateIndex
CREATE INDEX "Team_divisionId_idx" ON "Team"("divisionId");

-- CreateIndex
CREATE INDEX "Match_divisionId_status_idx" ON "Match"("divisionId", "status");

-- CreateIndex
CREATE INDEX "Match_seasonId_week_idx" ON "Match"("seasonId", "week");

-- CreateIndex
CREATE INDEX "Match_homeTeamId_idx" ON "Match"("homeTeamId");

-- CreateIndex
CREATE INDEX "Match_awayTeamId_idx" ON "Match"("awayTeamId");

-- CreateIndex
CREATE UNIQUE INDEX "Match_seasonId_week_homeTeamId_awayTeamId_key" ON "Match"("seasonId", "week", "homeTeamId", "awayTeamId");

-- CreateIndex
CREATE INDEX "StatLine_playerId_idx" ON "StatLine"("playerId");

-- CreateIndex
CREATE INDEX "StatLine_teamId_idx" ON "StatLine"("teamId");
