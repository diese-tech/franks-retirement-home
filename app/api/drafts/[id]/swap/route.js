import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { resolveRole } from '@/lib/draftAuth';
import { syncDraftLobbyState } from '@/lib/draftLifecycle';

export const dynamic = 'force-dynamic';

// POST /api/drafts/[id]/swap
// Body: { key, outPlayerId, inPlayerId }
// Replaces a player on a team with a free agent. Available during lobby (captains + admin)
// and during pending (admin only).
export async function POST(request, { params }) {
  const { id } = await params;
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { key, outPlayerId, inPlayerId } = body;
  if (!outPlayerId || !inPlayerId) {
    return NextResponse.json({ error: 'outPlayerId and inPlayerId required' }, { status: 400 });
  }
  if (outPlayerId === inPlayerId) {
    return NextResponse.json({ error: 'Cannot swap a player with themselves' }, { status: 400 });
  }

  try {
    const draft = await prisma.draft.findUnique({ where: { id } });
    if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });

    const role = resolveRole(key, draft);
    if (role === 'spectator') {
      return NextResponse.json({ error: 'Not authorized to swap players' }, { status: 403 });
    }

    const allowedStatuses = role === 'admin' ? ['pending', 'lobby'] : ['lobby'];
    if (!allowedStatuses.includes(draft.status)) {
      return NextResponse.json(
        { error: 'Player swaps are only allowed during the lobby phase' },
        { status: 400 }
      );
    }

    const outPick = await prisma.draftPick.findFirst({
      where: { draftId: id, playerId: outPlayerId },
    });
    if (!outPick) return NextResponse.json({ error: 'Player not found on any team' }, { status: 404 });

    if (role === 'captainA' && outPick.team !== 'A') {
      return NextResponse.json({ error: "Can only swap your own team's players" }, { status: 403 });
    }
    if (role === 'captainB' && outPick.team !== 'B') {
      return NextResponse.json({ error: "Can only swap your own team's players" }, { status: 403 });
    }

    const inPlayerExists = await prisma.player.findUnique({ where: { id: inPlayerId } });
    if (!inPlayerExists) return NextResponse.json({ error: 'Incoming player not found' }, { status: 404 });

    const inPlayerAlreadyPicked = await prisma.draftPick.findFirst({
      where: { draftId: id, playerId: inPlayerId },
    });
    if (inPlayerAlreadyPicked) {
      return NextResponse.json({ error: 'Player is already on a team' }, { status: 409 });
    }

    await prisma.$transaction([
      prisma.draftPick.delete({ where: { id: outPick.id } }),
      prisma.draftPick.create({
        data: { draftId: id, playerId: inPlayerId, team: outPick.team, pickOrder: outPick.pickOrder },
      }),
      prisma.draft.update({ where: { id }, data: { version: { increment: 1 } } }),
    ]);
    await syncDraftLobbyState(id);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to swap player' }, { status: 500 });
  }
}
