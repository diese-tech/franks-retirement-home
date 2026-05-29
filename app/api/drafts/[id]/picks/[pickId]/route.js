import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { resolveDraftCaptainAuth } from '@/lib/resolveAuth';

export const dynamic = 'force-dynamic';

// PATCH /api/drafts/[id]/picks/[pickId]
// Assign or clear a player on a DraftPick slot — Lineup Confirmation step.
// Allowed after draft status = 'complete' for match-bound drafts.
// Body: { key, playerId }  (playerId = null clears the assignment)
// Auth: captain of the pick's team, or admin.
export async function PATCH(req, { params }) {
  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { key, playerId } = body;

  try {
    const draft = await prisma.draft.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        status: true,
        gameId: true,
        adminKey: true,
        captainAKey: true,
        captainBKey: true,
        game: {
          select: {
            match: {
              select: {
                homeTeamId: true,
                awayTeamId: true,
              },
            },
          },
        },
      },
    });

    if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    if (draft.status !== 'complete') {
      return NextResponse.json({ error: 'Lineup Confirmation is only available after draft is complete' }, { status: 400 });
    }

    const auth = await resolveDraftCaptainAuth(req, draft, key);
    const role = auth.role;
    if (role === 'spectator') {
      return NextResponse.json({ error: 'Captain or admin key required' }, { status: 401 });
    }

    const pick = await prisma.draftPick.findUnique({ where: { id: params.pickId } });
    if (!pick || pick.draftId !== params.id) {
      return NextResponse.json({ error: 'Pick not found' }, { status: 404 });
    }

    // Captains can only update their own team's slots
    const captainTeam = role === 'captainA' ? 'A' : role === 'captainB' ? 'B' : null;
    if (captainTeam && pick.team !== captainTeam) {
      return NextResponse.json({ error: 'Cannot assign players to the opposing team' }, { status: 403 });
    }

    // If assigning a player, validate they belong to the correct team
    if (playerId) {
      const match = draft.game?.match;
      if (match) {
        const expectedTeamId = pick.team === 'A' ? match.homeTeamId : match.awayTeamId;
        const membership = await prisma.teamMember.findUnique({
          where: { teamId_playerId: { teamId: expectedTeamId, playerId } },
        });
        if (!membership) {
          return NextResponse.json({ error: 'Player is not a member of the correct team' }, { status: 400 });
        }
      }

      // Check player isn't already assigned to another slot in this draft
      const conflict = await prisma.draftPick.findFirst({
        where: {
          draftId: params.id,
          playerId,
          id: { not: params.pickId },
        },
      });
      if (conflict) {
        return NextResponse.json({ error: 'Player is already assigned to another pick slot in this draft' }, { status: 409 });
      }
    }

    const updated = await prisma.draftPick.update({
      where: { id: params.pickId },
      data: { playerId: playerId || null },
      include: {
        player: { select: { id: true, name: true, role: true } },
        god: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: 'Failed to update pick' }, { status: 500 });
  }
}
