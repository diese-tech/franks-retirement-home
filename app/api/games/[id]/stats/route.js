import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAdmin } from '@/lib/adminSession';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// GET /api/games/[id]/stats — public: stat lines for a game
export async function GET(_req, { params }) {
  try {
    const stats = await prisma.statLine.findMany({
      where: { gameId: params.id },
      orderBy: [{ teamId: 'asc' }, { kills: 'desc' }],
      include: {
        player: { select: { id: true, name: true, role: true } },
        team: { select: { id: true, name: true, tag: true } },
        god: { select: { id: true, name: true, role: true } },
      },
    });
    return NextResponse.json(stats);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}

// POST /api/games/[id]/stats — admin: upsert a stat line for one player
// Body: { playerId, teamId, kills, deaths, assists, damage, healing, gold, godId?, role?, notes? }
// Uses upsert on (gameId, playerId) so admins can re-enter corrected values.
export async function POST(req, { params }) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { playerId, teamId, kills = 0, deaths = 0, assists = 0, damage = 0, healing = 0, gold = 0, godId, role, notes } = body;
  if (!playerId || !teamId) {
    return NextResponse.json({ error: 'playerId and teamId are required' }, { status: 400 });
  }

  try {
    const stat = await prisma.statLine.upsert({
      where: { gameId_playerId: { gameId: params.id, playerId } },
      create: {
        gameId: params.id,
        playerId,
        teamId,
        kills: parseInt(kills, 10) || 0,
        deaths: parseInt(deaths, 10) || 0,
        assists: parseInt(assists, 10) || 0,
        damage: parseInt(damage, 10) || 0,
        healing: parseInt(healing, 10) || 0,
        gold: parseInt(gold, 10) || 0,
        godId: godId || null,
        role: role || null,
        notes: notes || null,
      },
      update: {
        teamId,
        kills: parseInt(kills, 10) || 0,
        deaths: parseInt(deaths, 10) || 0,
        assists: parseInt(assists, 10) || 0,
        damage: parseInt(damage, 10) || 0,
        healing: parseInt(healing, 10) || 0,
        gold: parseInt(gold, 10) || 0,
        godId: godId || null,
        role: role || null,
        notes: notes || null,
      },
      include: {
        player: { select: { id: true, name: true } },
        god: { select: { id: true, name: true } },
      },
    });
    logAudit('StatLine', stat.id, 'upserted', { payload: { gameId: params.id, playerId } });
    return NextResponse.json(stat, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to save stat line' }, { status: 500 });
  }
}

// DELETE /api/games/[id]/stats?playerId=... — admin: remove one stat line
export async function DELETE(req, { params }) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const playerId = searchParams.get('playerId');
  if (!playerId) return NextResponse.json({ error: 'playerId query param required' }, { status: 400 });

  try {
    await prisma.statLine.delete({
      where: { gameId_playerId: { gameId: params.id, playerId } },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete stat line' }, { status: 500 });
  }
}
