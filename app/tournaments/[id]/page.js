import prisma from '@/lib/db';
import { notFound } from 'next/navigation';
import { matchState } from '@/lib/bracketEngine';
import TournamentClient from './TournamentClient';

export const dynamic = 'force-dynamic';

// Builds the same { tournament, participants, matches } shape the SSE stream
// (workstream C, app/api/tournaments/[id]/stream) pushes on every update —
// see docs/tournament-bracket-implementation-plan.md's Phase 1 contract.
// Queried directly here (rather than via C's HTTP route) so this page's
// first paint doesn't depend on C's routes existing yet; TournamentClient
// then hands off to the live SSE stream for real-time updates.
function buildInitialState(tournament) {
  const participantsById = Object.fromEntries(
    tournament.participants.map((p) => [p.id, { id: p.id, name: p.name, seed: p.seed }])
  );
  const lookup = (participantId) => (participantId ? participantsById[participantId] ?? null : null);

  return {
    tournament: {
      id: tournament.id,
      name: tournament.name,
      status: tournament.status,
      version: tournament.version,
    },
    participants: Object.values(participantsById),
    matches: tournament.matches.map((m) => ({
      id: m.id,
      round: m.round,
      position: m.position,
      slot1: lookup(m.slot1ParticipantId),
      slot2: lookup(m.slot2ParticipantId),
      winner: lookup(m.winnerParticipantId),
      state: matchState(m),
    })),
  };
}

export default async function TournamentPage({ params }) {
  const { id } = await params;

  let tournament = null;
  let dbError = false;
  try {
    tournament = await prisma.tournament.findUnique({
      where: { id },
      include: {
        participants: { orderBy: { seed: 'asc' } },
        matches: { orderBy: [{ round: 'asc' }, { position: 'asc' }] },
      },
    });
  } catch (err) {
    console.error('[tournament]', err);
    dbError = true;
  }

  if (dbError) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center card">
        <p className="text-red-400 mb-4">Unable to load tournament. Database may be unreachable.</p>
        <a href="/tournaments" className="btn-secondary text-xs">&larr; Back to Tournaments</a>
      </div>
    );
  }

  // Draft tournaments are admin-only setup and never shown on the viewer —
  // the ID isn't secret the way a Draft's adminKey is, so this 404s
  // regardless of who requests it (ADR-0006).
  if (!tournament || tournament.status === 'draft') notFound();

  return (
    <TournamentClient
      tournamentId={tournament.id}
      initialState={buildInitialState(tournament)}
    />
  );
}
