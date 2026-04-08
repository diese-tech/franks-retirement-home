import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

// GET /api/players — list all, optional ?role=Mid filter
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const role = searchParams.get('role');

  const players = await prisma.player.findMany({
    where: role ? { role } : undefined,
    orderBy: { pointValue: 'desc' },
  });
  return NextResponse.json(players);
}

// POST /api/players — create or update player
// Body: { id?, name, role, pointValue }
export async function POST(request) {
  const body = await request.json();
  const { id, name, role, pointValue } = body;

  if (!name || !role) {
    return NextResponse.json({ error: 'name and role required' }, { status: 400 });
  }

  if (id) {
    // Update
    const player = await prisma.player.update({
      where: { id },
      data: { name, role, pointValue: Number(pointValue) },
    });
    return NextResponse.json(player);
  }

  // Create
  const player = await prisma.player.create({
    data: { name, role, pointValue: Number(pointValue) || 1 },
  });
  return NextResponse.json(player, { status: 201 });
}

// DELETE /api/players?id=xxx
export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  await prisma.player.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
