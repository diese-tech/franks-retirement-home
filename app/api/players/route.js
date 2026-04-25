import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { PLAYER_ROLES } from '@/lib/constants';

const LIVE_STATUSES = ['lobby', 'banning', 'picking', 'active'];

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
    return NextResponse.json(players);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch players' }, { status: 500 });
  }
}

export async function POST(request) {
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

  const data = {
    name: name.trim(),
    role,
    discordUsername: discordUsername?.trim() || null,
    division: division?.trim() || null,
  };

  try {
    if (id) {
      const player = await prisma.player.update({ where: { id }, data });
      return NextResponse.json(player);
    }
    const player = await prisma.player.create({ data });
    return NextResponse.json(player, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to save player' }, { status: 500 });
  }
}

export async function DELETE(request) {
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
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete player' }, { status: 500 });
  }
}
