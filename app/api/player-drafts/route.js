import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import prisma from '@/lib/db';
import { resolveAdminAuth } from '@/lib/resolveAuth';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const seasonId = searchParams.get('seasonId');
  const divisionId = searchParams.get('divisionId');

  const where = {};
  if (seasonId) where.seasonId = seasonId;
  if (divisionId) where.divisionId = divisionId;

  try {
    const drafts = await prisma.playerDraft.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        season:   { select: { id: true, name: true, slug: true } },
        division: { select: { id: true, name: true } },
        _count:   { select: { picks: true } },
      },
    });
    return NextResponse.json(drafts.map(({ adminKey: _ak, ...d }) => d));
  } catch {
    return NextResponse.json({ error: 'Failed to fetch player drafts' }, { status: 500 });
  }
}

export async function POST(req) {
  const authError = await resolveAdminAuth(req);
  if (authError) return authError;

  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { seasonId, divisionId, name, rounds, pickTimerSeconds } = body;
  if (!seasonId || !divisionId) {
    return NextResponse.json({ error: 'seasonId and divisionId are required' }, { status: 400 });
  }

  try {
    const draft = await prisma.playerDraft.create({
      data: {
        seasonId,
        divisionId,
        name: name || 'Player Draft',
        rounds: rounds ? parseInt(rounds, 10) : 5,
        pickTimerSeconds: pickTimerSeconds !== undefined ? parseInt(pickTimerSeconds, 10) : 120,
        adminKey: randomUUID(),
      },
    });
    return NextResponse.json(draft, { status: 201 });
  } catch (e) {
    if (e.code === 'P2002') {
      return NextResponse.json({ error: 'A player draft already exists for this season + division' }, { status: 409 });
    }
    if (e.code === 'P2003') {
      return NextResponse.json({ error: 'Invalid seasonId or divisionId' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create player draft' }, { status: 500 });
  }
}
