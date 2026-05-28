import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { resolveAdminAuth } from '@/lib/resolveAuth';
import { getDiscordSessionUser } from '@/lib/discordAuth';

// GET /api/admin/betting-lines?status=open
export async function GET(request) {
  const guard = await resolveAdminAuth(request);
  if (guard) return guard;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');

  try {
    const lines = await prisma.bettingLine.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        match: { include: { division: { select: { name: true } } } },
        teamA: { select: { id: true, name: true, tag: true } },
        teamB: { select: { id: true, name: true, tag: true } },
        _count: { select: { bets: true } },
      },
    });
    return NextResponse.json(lines);
  } catch (err) {
    console.error('[admin/betting-lines GET]', err);
    return NextResponse.json({ error: 'Failed to load lines' }, { status: 500 });
  }
}

// POST /api/admin/betting-lines  — open a line for a match
export async function POST(request) {
  const guard = await resolveAdminAuth(request);
  if (guard) return guard;

  const session = getDiscordSessionUser(request);

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { matchId, teamAId, teamAOdds, teamBId, teamBOdds, closesAt } = body;

  if (!matchId || !teamAId || !teamBId) {
    return NextResponse.json({ error: 'matchId, teamAId, and teamBId are required' }, { status: 400 });
  }
  if (teamAId === teamBId) {
    return NextResponse.json({ error: 'teamA and teamB must differ' }, { status: 400 });
  }
  if (!Number.isInteger(teamAOdds) || !Number.isInteger(teamBOdds)) {
    return NextResponse.json({ error: 'odds must be integers (e.g. 110 for +110, -120)' }, { status: 400 });
  }

  // Verify the match exists and the teams belong to it.
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { id: true, homeTeamId: true, awayTeamId: true },
  });
  if (!match) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 });
  }
  const validTeams = new Set([match.homeTeamId, match.awayTeamId]);
  if (!validTeams.has(teamAId) || !validTeams.has(teamBId)) {
    return NextResponse.json({ error: 'teams must be the two teams in this match' }, { status: 400 });
  }

  try {
    const line = await prisma.bettingLine.create({
      data: {
        matchId,
        teamAId,
        teamAOdds,
        teamBId,
        teamBOdds,
        status: 'open',
        closesAt: closesAt ? new Date(closesAt) : null,
        createdById: session?.username ?? 'FRH Staff',
      },
    });
    return NextResponse.json(line, { status: 201 });
  } catch (err) {
    console.error('[admin/betting-lines POST]', err);
    return NextResponse.json({ error: 'Failed to create line' }, { status: 500 });
  }
}
