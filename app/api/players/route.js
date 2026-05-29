import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { PLAYER_ROLES } from '@/lib/constants';
import { resolveAdminAuth } from '@/lib/resolveAuth';
import { invalidatePlayers } from '@/lib/referenceData';

export const dynamic = 'force-dynamic';

const LIVE_STATUSES = ['lobby', 'banning', 'picking'];

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const role = searchParams.get('role');

  if (role && !PLAYER_ROLES.includes(role)) {
    return NextResponse.json({ error: `role must be one of: ${PLAYER_ROLES.join(', ')}` }, { status: 400 });
  }

  try {
    const players = await prisma.player.findMany({
      where: role ? { role } : undefined,
      orderBy: { name: 'asc' },
    });
    const res = NextResponse.json(players);
    res.headers.set('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res;
  } catch {
    return NextResponse.json({ error: 'Failed to fetch players' }, { status: 500 });
  }
}

export async function POST(request) {
  const guard = await resolveAdminAuth(request);
  if (guard) return guard;

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { id, name, role, discordUsername, division } = body;

  if (!name || typeof name !== 'string' || name.trim().length === 0 || name.length > 100) {
    return NextResponse.json({ error: 'name must be a non-empty string (max 100 chars)' }, { status: 400 });
  }
  if (!PLAYER_ROLES.includes(role)) {
    return NextResponse.json({ error: `role must be one of: ${PLAYER_ROLES.join(', ')}` }, { status: 400 });
  }
  if (typeof discordUsername === 'string' && discordUsername.length > 64) {
    return NextResponse.json({ error: 'discordUsername must be 64 characters or fewer' }, { status: 400 });
  }
  if (typeof division === 'string' && division.length > 64) {
    return NextResponse.json({ error: 'division must be 64 characters or fewer' }, { status: 400 });
  }

  const data = {
    name: name.trim(),
    role,
    discordUsername: typeof discordUsername === 'string' ? (discordUsername.trim() || null) : null,
    division: typeof division === 'string' ? (division.trim() || null) : null,
  };

  try {
    if (id) {
      const player = await prisma.player.update({ where: { id }, data });
      invalidatePlayers();
      return NextResponse.json(player);
    }
    const player = await prisma.player.create({ data });
    invalidatePlayers();
    return NextResponse.json(player, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to save player' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const guard = await resolveAdminAuth(request);
  if (guard) return guard;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  try {
    const activePick = await prisma.draftPick.findFirst({
      where: { playerId: id, draft: { status: { in: LIVE_STATUSES } } },
    });
    if (activePick) {
      return NextResponse.json(
        { error: 'Cannot delete a player who is part of a live draft. Finalize or remove them from the draft first.' },
        { status: 409 }
      );
    }
    await prisma.player.delete({ where: { id } });
    invalidatePlayers();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete player' }, { status: 500 });
  }
}
