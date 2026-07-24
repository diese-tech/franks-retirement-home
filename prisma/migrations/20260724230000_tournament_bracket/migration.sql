-- Tournament bracket feature (docs/tournament-bracket-implementation-plan.md,
-- docs/adr/0001-0003, 0006-0009): standalone single-elimination brackets,
-- decoupled from Season/Division/Team.

-- CreateTable
CREATE TABLE "Tournament" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Participant" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "seed" INTEGER NOT NULL,

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BracketMatch" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "slot1ParticipantId" TEXT,
    "slot2ParticipantId" TEXT,
    "winnerParticipantId" TEXT,
    "nextMatchId" TEXT,
    "nextMatchSlot" INTEGER,
    "loserNextMatchId" TEXT,
    "loserNextMatchSlot" INTEGER,

    CONSTRAINT "BracketMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Participant_tournamentId_seed_key" ON "Participant"("tournamentId", "seed");

-- CreateIndex
CREATE UNIQUE INDEX "BracketMatch_tournamentId_round_position_key" ON "BracketMatch"("tournamentId", "round", "position");

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BracketMatch" ADD CONSTRAINT "BracketMatch_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
