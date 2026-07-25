import prisma from '@/lib/db';
import { matchState } from '@/lib/bracketEngine';

// Returns the full sanitized state used by the viewer's /state endpoint and
// the /stream SSE 'state' frames. Returns null when the tournament doesn't
// exist OR when it's still `draft` (docs/adr/0003, docs/adr/0006).
//
// The draft exclusion lives here — not just in the /api/tournaments list
// route — because a Tournament's id isn't secret the way a Draft's
// adminKey is (docs/tournament-bracket-implementation-plan.md, workstream
// C). Anyone who guesses/links a draft tournament's id must still get
// nothing back from the per-id state/stream routes.
export async function buildTournamentState(tournamentId) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      participants: true,
      matches: true,
    },
  });

  if (!tournament || tournament.status === 'draft') return null;

  const participantsById = new Map(tournament.participants.map((p) => [p.id, p]));
  const resolveParticipant = (participantId) => {
    if (!participantId) return null;
    const participant = participantsById.get(participantId);
    return participant ? { id: participant.id, name: participant.name } : null;
  };

  const participants = tournament.participants
    .slice()
    .sort((a, b) => a.seed - b.seed)
    .map((p) => ({ id: p.id, name: p.name, seed: p.seed }));

  const matches = tournament.matches
    .slice()
    .sort((a, b) => a.round - b.round || a.position - b.position)
    .map((match) => ({
      id: match.id,
      round: match.round,
      position: match.position,
      slot1: resolveParticipant(match.slot1ParticipantId),
      slot2: resolveParticipant(match.slot2ParticipantId),
      winner: resolveParticipant(match.winnerParticipantId),
      state: matchState(match),
    }));

  return {
    tournament: {
      id: tournament.id,
      name: tournament.name,
      status: tournament.status,
      version: tournament.version,
    },
    participants,
    matches,
  };
}
