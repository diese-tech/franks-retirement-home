-- Enable RLS on the pre-existing tables (docs/production-readiness-implementation-plan.md,
-- Workstream 3; docs/adr/0005-rls-already-enabled-known-gaps.md): closes the last of the
-- "RLS Disabled in Public" ERROR-level advisor findings on the FRH project
-- (vxfakbgrmiqrstigjlug), following the same pattern already applied to
-- Tournament/Participant/BracketMatch in
-- prisma/migrations/20260724230000_tournament_bracket/migration.sql.

-- Enable RLS with no policies, matching every other non-public-read table in
-- this project (docs/adr/0005): default-deny for the anon/authenticated
-- roles Supabase's Data API exposes. The app reads and writes these tables
-- exclusively through Prisma's `postgres` role, which has BYPASSRLS, so this
-- has no effect on application behavior — it only closes the direct-REST-API
-- surface.
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Season" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Division" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Org" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Team" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TeamMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Match" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Game" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlayerDraft" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlayerDraftPick" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MatchSubmission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SubmissionAttachment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Player" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "God" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Draft" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DraftPick" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DraftBan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DraftChat" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StatLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RescheduleRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OcrExtraction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExtractedStatLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlayerAlias" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "HomepageContent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlayerClaim" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RosterImport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RosterImportRow" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BulletinPost" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "HomepageSectionConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EditorialCase" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Wallet" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WalletTransaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BettingLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Bet" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BulletinReaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BulletinComment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Superlative" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChangeRequest" ENABLE ROW LEVEL SECURITY;
