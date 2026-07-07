import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { resolveAdminAuth } from '@/lib/resolveAuth';
import { SEASON_STATUSES } from '@/lib/constants';

export const dynamic = 'force-dynamic';

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

  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const { name, slug, status, startsAt, endsAt } = body;

  try {
    if (!name || !slug) {
      return NextResponse.json({ error: 'name and slug are required' }, { status: 400 });
    }
    if (status !== undefined && !SEASON_STATUSES.includes(status)) {
      return NextResponse.json({ error: `status must be one of: ${SEASON_STATUSES.join(', ')}` }, { status: 400 });
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
