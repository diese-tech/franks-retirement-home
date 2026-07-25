import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { resolveAdminAuth } from '@/lib/resolveAuth';
import { recordWinner as engineRecordWinner, isTournamentComplete, matchState } from '@/lib/bracketEngine';

const VALID_ACTIONS = ['editParticipant', 'reseed', 'recordWinner', 'publish', 'reset', 'delete'];
const MAX_NAME_LENGTH = 100;

// PATCH /api/admin/tournaments/[id] — action-discriminated admin mutations.
// Every branch bumps Tournament.version by exactly 1 in the same transaction
// as its mutation (except `delete`, which removes the row outright) so the
// viewer SSE stream (workstream C) notices the change on its next poll.
export async function PATCH(request, { params }) {
  const guard = await resolveAdminAuth(request);
  if (guard) return guard;

  const { id } = params;

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { action } = body;
  if (!VALID_ACTIONS.includes(action)) {
    return NextResponse.json({ error: `action must be one of: ${VALID_ACTIONS.join(', ')}` }, { status: 400 });
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!tournament) {
    return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
  }

  try {
    if (action === 'editParticipant') return await handleEditParticipant(tournament, body);
    if (action === 'reseed') return await handleReseed(tournament, body);
    if (action === 'recordWinner') return await handleRecordWinner(tournament, body);
    if (action === 'publish') return await handlePublish(tournament);
    if (action === 'reset') return await handleReset(tournament);
    return await handleDelete(tournament);
  } catch (err) {
    const status = err?.httpStatus ?? 500;
    if (status === 500) console.error('[admin/tournaments PATCH]', err);
    return NextResponse.json({ error: status === 500 ? 'Failed to update tournament' : err.message }, { status });
  }
}

function badRequest(message) {
  return Object.assign(new Error(message), { httpStatus: 400 });
}

function notFound(message) {
  return Object.assign(new Error(message), { httpStatus: 404 });
}

// ADR-0008: a Participant's slot can only be edited or reseeded while every
// BracketMatch it occupies is still un-decided. Once a match records a
// winner, that participant (winner or loser) is locked — this applies to
// edits and reseeds alike, not just reseeds.
function assertParticipantUnlocked(matches, participantId) {
  const locked = matches.some(
    (m) =>
      (m.slot1ParticipantId === participantId || m.slot2ParticipantId === participantId) &&
      matchState(m) === 'decided'
  );
  if (locked) {
    throw badRequest('This participant has a decided match and can no longer be edited or reseeded');
  }
}

// editParticipant: { action: 'editParticipant', participantId, name }
async function handleEditParticipant(tournament, body) {
  const { participantId, name } = body;
  if (typeof participantId !== 'string' || !participantId) {
    throw badRequest('participantId is required');
  }
  if (typeof name !== 'string' || !name.trim() || name.length > MAX_NAME_LENGTH) {
    throw badRequest(`name is required and must be ${MAX_NAME_LENGTH} characters or fewer`);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const [participant, matches] = await Promise.all([
      tx.participant.findUnique({ where: { id: participantId } }),
      tx.bracketMatch.findMany({ where: { tournamentId: tournament.id } }),
    ]);
    if (!participant || participant.tournamentId !== tournament.id) {
      throw notFound('Participant not found');
    }

    assertParticipantUnlocked(matches, participantId);

    await tx.participant.update({ where: { id: participantId }, data: { name: name.trim() } });
    return tx.tournament.update({
      where: { id: tournament.id },
      data: { version: { increment: 1 } },
    });
  });

  return NextResponse.json({ id: updated.id, version: updated.version });
}

// reseed: { action: 'reseed', participantId, seed }
// `seed` is the target seed to move this participant into — whichever
// participant currently holds it swaps back to the requester's old seed.
// Round-1 BracketMatch slots are the only ones seed maps to directly
// (later rounds are filled by recordWinner cascades), so the swap only
// touches round-1 rows.
async function handleReseed(tournament, body) {
  const { participantId, seed } = body;
  if (typeof participantId !== 'string' || !participantId) {
    throw badRequest('participantId is required');
  }
  if (!Number.isInteger(seed) || seed < 0) {
    throw badRequest('seed must be a non-negative integer');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const [participant, matches] = await Promise.all([
      tx.participant.findUnique({ where: { id: participantId } }),
      tx.bracketMatch.findMany({ where: { tournamentId: tournament.id } }),
    ]);
    if (!participant || participant.tournamentId !== tournament.id) {
      throw notFound('Participant not found');
    }

    assertParticipantUnlocked(matches, participantId);

    const other = await tx.participant.findFirst({
      where: { tournamentId: tournament.id, seed },
    });
    if (!other) {
      throw badRequest('No participant currently holds that seed');
    }

    if (other.id !== participant.id) {
      assertParticipantUnlocked(matches, other.id);

      const round1 = matches.filter((m) => m.round === 1);
      const slotFor = (seedValue) => {
        const position = Math.floor(seedValue / 2);
        const match = round1.find((m) => m.position === position);
        if (!match) throw badRequest('Invalid seed for this bracket size');
        const slotKey = seedValue % 2 === 0 ? 'slot1ParticipantId' : 'slot2ParticipantId';
        return { match, slotKey };
      };

      const from = slotFor(participant.seed);
      const to = slotFor(seed);
      const participantOriginalSeed = participant.seed;

      // Swap seeds via a temporary sentinel — @@unique([tournamentId, seed])
      // is checked per-statement, so both participants can't hold the same
      // seed even transiently within the transaction.
      await tx.participant.update({ where: { id: participant.id }, data: { seed: -1 } });
      await tx.participant.update({ where: { id: other.id }, data: { seed: participantOriginalSeed } });
      await tx.participant.update({ where: { id: participant.id }, data: { seed } });

      await tx.bracketMatch.update({ where: { id: from.match.id }, data: { [from.slotKey]: other.id } });
      await tx.bracketMatch.update({ where: { id: to.match.id }, data: { [to.slotKey]: participant.id } });
    }

    return tx.tournament.update({
      where: { id: tournament.id },
      data: { version: { increment: 1 } },
    });
  });

  return NextResponse.json({ id: updated.id, version: updated.version });
}

// recordWinner: { action: 'recordWinner', matchId, winnerParticipantId }
async function handleRecordWinner(tournament, body) {
  const { matchId, winnerParticipantId } = body;
  if (typeof matchId !== 'string' || !matchId) {
    throw badRequest('matchId is required');
  }
  if (typeof winnerParticipantId !== 'string' || !winnerParticipantId) {
    throw badRequest('winnerParticipantId is required');
  }
  if (tournament.status !== 'live') {
    throw badRequest('Winners can only be recorded on a live tournament');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const matches = await tx.bracketMatch.findMany({ where: { tournamentId: tournament.id } });

    let nextMatches;
    try {
      nextMatches = engineRecordWinner(matches, matchId, winnerParticipantId);
    } catch (err) {
      // Unready match or a winner that isn't one of the two slots.
      throw badRequest(err.message);
    }

    // Write only the fields that actually differ per match, not the full
    // slot1/slot2/winner triple from this transaction's read snapshot. Two
    // sibling matches decided concurrently both cascade into the same
    // downstream match, each only touching its own slot column — writing
    // the untouched slot back from a stale snapshot would otherwise let
    // whichever transaction commits last clobber the other's newly-filled
    // slot. Prisma issues a plain column SET (no compare-and-swap), so
    // restricting each update to only the columns this cascade changed is
    // what keeps the two concurrent single-column writes from colliding.
    for (const match of nextMatches) {
      const original = matches.find((om) => om.id === match.id);
      const data = {};
      if (original.winnerParticipantId !== match.winnerParticipantId) data.winnerParticipantId = match.winnerParticipantId;
      if (original.slot1ParticipantId !== match.slot1ParticipantId) data.slot1ParticipantId = match.slot1ParticipantId;
      if (original.slot2ParticipantId !== match.slot2ParticipantId) data.slot2ParticipantId = match.slot2ParticipantId;
      if (Object.keys(data).length === 0) continue;

      await tx.bracketMatch.update({ where: { id: match.id }, data });
    }

    const completed = isTournamentComplete(nextMatches);

    return tx.tournament.update({
      where: { id: tournament.id },
      data: {
        version: { increment: 1 },
        ...(completed ? { status: 'completed' } : {}),
      },
    });
  });

  return NextResponse.json({ id: updated.id, status: updated.status, version: updated.version });
}

// publish: draft -> live only
async function handlePublish(tournament) {
  if (tournament.status !== 'draft') {
    throw badRequest('Only a draft tournament can be published');
  }

  const updated = await prisma.$transaction((tx) =>
    tx.tournament.update({
      where: { id: tournament.id },
      data: { status: 'live', version: { increment: 1 } },
    })
  );

  return NextResponse.json({ id: updated.id, status: updated.status, version: updated.version });
}

// reset: clears every recorded winner back to the initial unplayed topology.
// Round-1 slots are the seeded placements (participants/seeds unchanged, per
// the spec) so only their winnerParticipantId is cleared; every later round
// was only ever populated by a recordWinner cascade, so its slots are
// cleared too. Moves status back to `live` if it had reached `completed`.
async function handleReset(tournament) {
  const updated = await prisma.$transaction(async (tx) => {
    await tx.bracketMatch.updateMany({
      where: { tournamentId: tournament.id, round: { gt: 1 } },
      data: { slot1ParticipantId: null, slot2ParticipantId: null, winnerParticipantId: null },
    });
    await tx.bracketMatch.updateMany({
      where: { tournamentId: tournament.id, round: 1 },
      data: { winnerParticipantId: null },
    });

    return tx.tournament.update({
      where: { id: tournament.id },
      data: {
        version: { increment: 1 },
        ...(tournament.status === 'completed' ? { status: 'live' } : {}),
      },
    });
  });

  return NextResponse.json({ id: updated.id, status: updated.status, version: updated.version });
}

// delete: Participants and BracketMatches cascade per the schema
// (onDelete: Cascade). No version bump — the row no longer exists.
async function handleDelete(tournament) {
  await prisma.tournament.delete({ where: { id: tournament.id } });
  return NextResponse.json({ ok: true });
}
