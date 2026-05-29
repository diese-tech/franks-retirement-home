import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { resolveAdminAuth } from '@/lib/resolveAuth';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const divisionId = searchParams.get('divisionId');
    const seasonId = searchParams.get('seasonId');

    const where = {};
    if (divisionId) where.divisionId = divisionId;
    if (seasonId) where.division = { seasonId };

    const teams = await prisma.team.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        division: { select: { name: true, tier: true } },
        org: { select: { name: true, tag: true, logoInitials: true, accentColor: true } },
        members: {
          where: { leftAt: null },
          include: { player: { select: { id: true, name: true, role: true, discordUsername: true } } },
        },
      },
    });
    const res = NextResponse.json(teams);
    res.headers.set('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res;
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch teams' }, { status: 500 });
  }
}

export async function POST(req) {
  const authError = await resolveAdminAuth(req);
  if (authError) return authError;

  try {
    const { divisionId, orgId, name, tag, captainPlayerId } = await req.json();
    if (!divisionId || !name || !tag) {
      return NextResponse.json({ error: 'divisionId, name, and tag are required' }, { status: 400 });
    }
    const team = await prisma.team.create({
      data: { divisionId, orgId, name, tag, captainPlayerId },
    });
    return NextResponse.json(team, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to create team' }, { status: 500 });
  }
}
