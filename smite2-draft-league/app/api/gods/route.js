import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

// GET /api/gods — list all, optional ?role=Mage
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const role = searchParams.get('role');

  const gods = await prisma.god.findMany({
    where: role ? { role } : undefined,
    orderBy: { name: 'asc' },
  });
  return NextResponse.json(gods);
}

// POST /api/gods — create or update
export async function POST(request) {
  const body = await request.json();
  const { id, name, role, godClass } = body;

  if (!name || !role || !godClass) {
    return NextResponse.json({ error: 'name, role, and godClass required' }, { status: 400 });
  }

  if (id) {
    const god = await prisma.god.update({
      where: { id },
      data: { name, role, godClass },
    });
    return NextResponse.json(god);
  }

  const god = await prisma.god.create({ data: { name, role, godClass } });
  return NextResponse.json(god, { status: 201 });
}

// DELETE /api/gods?id=xxx
export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  await prisma.god.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
