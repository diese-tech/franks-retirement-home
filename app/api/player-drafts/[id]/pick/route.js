import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { resolveAdminAuth } from '@/lib/resolveAuth';
import { getDiscordSessionUser } from '@/lib/discordAuth';
import { buildPlayerDraftFormat, getFirstDraftTurn, getNextDraftTurn, totalPicks } from '@/lib/playerDraftOrder';

export const dynamic = 'force-dynamic';

// POST /api/player-drafts/[id]/pick
// Body: { teamId, playerId }
// Auth: admin (any team) OR Discord captain of the active team.
export async function POST(req, { params }) {
  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { teamId, playerId } = body;
  if (!teamId || !playerId) {
    return NextResponse.json({ error: 'teamId and playerId are required' }, { status: 400 });
  }

  // Determine if the caller is an admin or an authorized captain.
  const adminError = await resolveAdminAuth(req);
  const isAdmin = !adminError;

  if (!isAdmin) {
    // Try Discord captain auth
    const session = getDiscordSessionUser(req);
    if (!session) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
    }

    // Find this player's TeamMember captain record for the active team in this draft
    const draft = await prisma.playerDraft.findUnique({
      where: { id: params.id },
      select: { divisionId: true, status: true },
    });
    if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    if (draft.status !== 'active') {
      return NextResponse.json({ error: 'Draft is not active' }, { status: 400 });
    }

    // Find player record by discordId
    const player = await prisma.player.findFirst({
      where: { discordId: session.discordId },
      select: { id: true },
    });
    if (!player) {
      return NextResponse.json({ error: 'Your Discord account is not linked to a player profile' }, { status: 403 });
    }

    // Find captain TeamMember in this draft's division
    const captainMembership = await prisma.teamMember.findFirst({
      where: {
        playerId: player.id,
        isCaptain: true,
        team: { divisionId: draft.divisionId },
      },
      select: { teamId: true },
    });

    if (!captainMembership) {
      return NextResponse.json({ error: 'You are not a captain in this draft\'s division' }, { status: 403 });
    }

    if (captainMembership.teamId !== teamId) {
      return NextResponse.json({ error: 'You can only submit picks for your own team' }, { status: 403 });
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const draft = await tx.playerDraft.findUnique({
        where: { id: params.id },
        include: { division: { select: { name: true } } },
      });

      if (!draft) throw Object.assign(new Error('not_found'), { status: 404 });
      if (draft.status !== 'active') throw Object.assign(new Error('Draft is not active'), { status: 400 });

      const currentOrder = Array.isArray(draft.currentOrder) ? draft.currentOrder : [];
      const format = buildPlayerDraftFormat(currentOrder, draft.rounds);
      const total = totalPicks(format);

      if (draft.currentPickIndex >= total) {
        throw Object.assign(new Error('Draft is already complete'), { status: 400 });
      }

      // Navigate cursor to currentPickIndex
      let turn = getFirstDraftTurn(format);
      for (let i = 0; i < draft.currentPickIndex && turn; i++) {
        turn = getNextDraftTurn(format, turn.phaseIndex, turn.stepIndex);
      }

      const activeTeamId = turn ? turn.teamId : null;
      if (activeTeamId !== teamId) {
        throw Object.assign(new Error(`It is not ${teamId}'s turn`), { status: 400 });
      }

      // Validate player eligibility
      const player = await tx.player.findUnique({ where: { id: playerId } });
      if (!player) throw Object.assign(new Error('Player not found'), { status: 404 });
      if (player.division !== draft.division.name) {
        throw Object.assign(new Error(`Player division "${player.division}" does not match draft division "${draft.division.name}"`), { status: 400 });
      }

      // Check player hasn't already been picked
      const existingPick = await tx.playerDraftPick.findUnique({
        where: { playerDraftId_playerId: { playerDraftId: params.id, playerId } },
      });
      if (existingPick) throw Object.assign(new Error('Player already drafted'), { status: 409 });

      const pickNumber = draft.currentPickIndex + 1;
      const nextIndex = pickNumber;
      const isComplete = nextIndex >= total;
      const nextTurn = turn ? getNextDraftTurn(format, turn.phaseIndex, turn.stepIndex) : null;

      await tx.playerDraftPick.create({
        data: {
          playerDraftId: params.id,
          pickNumber,
          teamId,
          playerId,
        },
      });

      const updated = await tx.playerDraft.update({
        where: { id: params.id },
        data: {
          currentPickIndex: nextIndex,
          status: isComplete ? 'complete' : 'active',
          completedAt: isComplete ? new Date() : null,
          pickStartedAt: isComplete ? null : new Date(),
          version: { increment: 1 },
        },
      });

      return { draft: updated, nextTurn, isComplete };
    });

    return NextResponse.json(result);
  } catch (e) {
    if (e.status) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: 'Failed to record pick' }, { status: 500 });
  }
}
