-- AlterTable: add Layer 1 captain result fields to "Game"
-- All columns are nullable so existing rows are unaffected.
ALTER TABLE "Game" ADD COLUMN "resultStatus"         TEXT;
ALTER TABLE "Game" ADD COLUMN "reportedWinnerTeamId" TEXT;
ALTER TABLE "Game" ADD COLUMN "reportedByTeamId"     TEXT;
ALTER TABLE "Game" ADD COLUMN "confirmedByTeamId"    TEXT;
ALTER TABLE "Game" ADD COLUMN "resultReportedAt"     TIMESTAMP(3);
ALTER TABLE "Game" ADD COLUMN "resultConfirmedAt"    TIMESTAMP(3);
ALTER TABLE "Game" ADD COLUMN "resultDisputedAt"     TIMESTAMP(3);
