import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { GOD_ROLES, GOD_CLASSES } from '@/lib/constants';

const LIVE_STATUSES = ['lobby', 'banning', 'picking', 'active'];

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const role = searchParams.get('role');

  if (role && !GOD_ROLES.includes(role)) {
    return NextResponse.json({ error: `role must be one of: ${GOD_ROLES.join(', ')}` }, { status: 400 });
  }

  try {
    const gods = await prisma.god.findMany({
      where: role ? { role } : undefined,
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(gods);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch gods' }, { status: 500 });
  }
}

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { id, name, role, godClass } = body;

  if (!name || typeof name !== 'string' || name.trim().length === 0 || name.length > 100) {
    return NextResponse.json({ error: 'name must be a non-empty string (max 100 chars)' }, { status: 400 });
  }
  if (!GOD_ROLES.includes(role)) {
    return NextResponse.json({ error: `role must be one of: ${GOD_ROLES.join(', ')}` }, { status: 400 });
  }
  if (!GOD_CLASSES.includes(godClass)) {
    return NextResponse.json({ error: `godClass must be one of: ${GOD_CLASSES.join(', ')}` }, { status: 400 });
  }

  try {
    if (id) {
      const god = await prisma.god.update({ where: { id }, data: { name: name.trim(), role, godClass } });
      return NextResponse.json(god);
    }
    const god = await prisma.god.create({ data: { name: name.trim(), role, godClass } });
    return NextResponse.json(god, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to save god' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  try {
    const activeBan = await prisma.draftBan.findFirst({
      where: { godId: id, draft: { status: { in: LIVE_STATUSES } } },
    });
    if (activeBan) {
      return NextResponse.json(
        { error: 'Cannot delete a god that is banned in a live draft.' },
        { status: 409 }
      );
    }
    const activePick = await prisma.draftPick.findFirst({
      where: { godId: id, draft: { status: { in: LIVE_STATUSES } } },
    });
    if (activePick) {
      return NextResponse.json(
        { error: 'Cannot delete a god that is picked in a live draft.' },
        { status: 409 }
      );
    }
    await prisma.god.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete god' }, { status: 500 });
  }
}
