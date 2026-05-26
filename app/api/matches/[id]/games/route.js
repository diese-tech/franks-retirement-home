import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAdmin } from '@/lib/adminSession';

export const dynamic = 'force-dynamic';

export async function GET(_req, { params }) {
  try {
    const games = await prisma.game.findMany({
      where: { matchId: params.id },
      orderBy: { gameNumber: 'asc' },
      include: {
        draft: { select: { id: true, status: true } },
      },
    });
    return NextResponse.json(games);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch games' }, { status: 500 });
  }
}

// PATCH /api/matches/[id]/games — admin: update a game directly (winnerTeamId override, durationSeconds)
export async function PATCH(req, { params }) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { gameId, winnerTeamId, durationSeconds } = body;
  if (!gameId) return NextResponse.json({ error: 'gameId is required' }, { status: 400 });

  try {
    const game = await prisma.game.update({
      where: { id: gameId, matchId: params.id },
      data: {
        ...(winnerTeamId !== undefined ? { winnerTeamId } : {}),
        ...(durationSeconds !== undefined ? { durationSeconds } : {}),
      },
      include: { draft: { select: { id: true, status: true } } },
    });
    return NextResponse.json(game);
  } catch (e) {
    if (e.code === 'P2025') return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    return NextResponse.json({ error: 'Failed to update game' }, { status: 500 });
  }
}
