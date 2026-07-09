import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { resolveAdminAuth } from '@/lib/resolveAuth';
import { logAudit } from '@/lib/auditLog';

export const dynamic = 'force-dynamic';

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

  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const { divisionId, orgId, name, tag, captainPlayerId } = body;

  try {
    if (!divisionId || !name || !tag) {
      return NextResponse.json({ error: 'divisionId, name, and tag are required' }, { status: 400 });
    }
    if (typeof name !== 'string' || name.length > 100) {
      return NextResponse.json({ error: 'name must be a string of at most 100 chars' }, { status: 400 });
    }
    if (typeof tag !== 'string' || tag.length > 10) {
      return NextResponse.json({ error: 'tag must be a string of at most 10 chars' }, { status: 400 });
    }
    const team = await prisma.team.create({
      data: { divisionId, orgId, name, tag, captainPlayerId },
    });
    logAudit({ entity: 'Team', entityId: team.id, action: 'team_created', adminId: 'admin', payload: { name, tag } });
    return NextResponse.json(team, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to create team' }, { status: 500 });
  }
}
