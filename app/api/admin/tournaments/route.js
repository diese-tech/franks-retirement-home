import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { resolveAdminAuth } from '@/lib/resolveAuth';
import { generateBracket } from '@/lib/bracketEngine';
import { reportServerError } from '@/lib/apiError';

export const dynamic = 'force-dynamic';

const MAX_NAME_LENGTH = 100;
const MAX_PARTICIPANTS = 128;

// GET /api/admin/tournaments — every Tournament regardless of status (the
// admin list shows drafts too, unlike the public /tournaments viewer),
// newest first, mirroring the GET+POST pairing every other admin collection
// route in this codebase uses (change-requests, superlatives, etc.).
export async function GET(request) {
  const guard = await resolveAdminAuth(request);
  if (guard) return guard;

  try {
    const tournaments = await prisma.tournament.findMany({
      include: { participants: { select: { id: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(tournaments);
  } catch (err) {
    reportServerError(err, { route: 'admin/tournaments GET' });
    return NextResponse.json({ error: 'Failed to load tournaments' }, { status: 500 });
  }
}

// POST /api/admin/tournaments — create a Tournament from a name + ordered
// participant names. Delegates the bracket-tree math to bracketEngine
// (docs/tournament-bracket-implementation-plan.md, Phase 0) and persists the
// Tournament + Participants + BracketMatches in one transaction.
export async function POST(request) {
  const guard = await resolveAdminAuth(request);
  if (guard) return guard;

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { name, participantNames } = body;

  if (typeof name !== 'string' || !name.trim() || name.length > MAX_NAME_LENGTH) {
    return NextResponse.json({ error: `name is required and must be ${MAX_NAME_LENGTH} characters or fewer` }, { status: 400 });
  }
  if (!Array.isArray(participantNames) || participantNames.length === 0) {
    return NextResponse.json({ error: 'participantNames must be a non-empty array' }, { status: 400 });
  }
  if (participantNames.length > MAX_PARTICIPANTS) {
    return NextResponse.json({ error: `Maximum ${MAX_PARTICIPANTS} participants per tournament` }, { status: 400 });
  }

  const cleanedNames = participantNames.map((n) => (typeof n === 'string' ? n.trim() : ''));
  if (cleanedNames.some((n) => !n || n.length > MAX_NAME_LENGTH)) {
    return NextResponse.json({ error: `participantNames must all be non-empty strings of ${MAX_NAME_LENGTH} characters or fewer` }, { status: 400 });
  }

  let bracket;
  try {
    // Power-of-2 validation (pad with literal "BYE" entries per ADR-0007)
    // happens inside the engine — catch and surface as a 400.
    bracket = generateBracket(cleanedNames);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  try {
    const tournament = await prisma.$transaction(async (tx) => {
      const created = await tx.tournament.create({
        data: { name: name.trim(), status: 'draft', version: 0 },
      });

      await tx.participant.createMany({
        data: bracket.participants.map((p) => ({
          id: p.id,
          tournamentId: created.id,
          name: p.name,
          seed: p.seed,
        })),
      });

      await tx.bracketMatch.createMany({
        data: bracket.matches.map((m) => ({
          id: m.id,
          tournamentId: created.id,
          round: m.round,
          position: m.position,
          slot1ParticipantId: m.slot1ParticipantId,
          slot2ParticipantId: m.slot2ParticipantId,
          winnerParticipantId: m.winnerParticipantId,
          nextMatchId: m.nextMatchId,
          nextMatchSlot: m.nextMatchSlot,
          loserNextMatchId: m.loserNextMatchId,
          loserNextMatchSlot: m.loserNextMatchSlot,
        })),
      });

      return created;
    });

    return NextResponse.json({ id: tournament.id }, { status: 201 });
  } catch (err) {
    reportServerError(err, { route: 'admin/tournaments POST' });
    return NextResponse.json({ error: 'Failed to create tournament' }, { status: 500 });
  }
}
