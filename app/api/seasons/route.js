import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { resolveAdminAuth } from '@/lib/resolveAuth';

export async function GET() {
  try {
    const seasons = await prisma.season.findMany({
      orderBy: { createdAt: 'desc' },
      include: { divisions: { orderBy: { tier: 'asc' } } },
    });
    return NextResponse.json(seasons);
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch seasons' }, { status: 500 });
  }
}

export async function POST(req) {
  const authError = await resolveAdminAuth(req);
  if (authError) return authError;

  try {
    const { name, slug, status, startsAt, endsAt } = await req.json();
    if (!name || !slug) {
      return NextResponse.json({ error: 'name and slug are required' }, { status: 400 });
    }
    const season = await prisma.season.create({
      data: { name, slug, status: status ?? 'upcoming', startsAt, endsAt },
    });
    return NextResponse.json(season, { status: 201 });
  } catch (e) {
    if (e.code === 'P2002') {
      return NextResponse.json({ error: 'Season slug already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create season' }, { status: 500 });
  }
}
