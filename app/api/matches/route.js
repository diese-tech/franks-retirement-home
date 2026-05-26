import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import prisma from '@/lib/db';
import { requireAdmin } from '@/lib/adminSession';

const FORMAT_GAME_COUNTS = { BO1: 1, BO3: 3, BO5: 5 };

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const seasonId = searchParams.get('seasonId');
  const divisionId = searchParams.get('divisionId');
  const week = searchParams.get('week');
  const status = searchParams.get('status');

  const where = {};
  if (seasonId) where.seasonId = seasonId;
  if (divisionId) where.divisionId = divisionId;
  if (week) where.week = parseInt(week, 10);
  if (status) where.status = status;

  try {
    const matches = await prisma.match.findMany({
      where,
      orderBy: [{ week: 'asc' }, { scheduledAt: 'asc' }],
      include: {
        season: { select: { id: true, name: true, slug: true } },
        division: { select: { id: true, name: true } },
        homeTeam: { select: { id: true, name: true, tag: true } },
        awayTeam: { select: { id: true, name: true, tag: true } },
        games: { orderBy: { gameNumber: 'asc' }, select: { id: true, gameNumber: true, winnerTeamId: true } },
      },
    });
    // Strip captain keys from public responses
    return NextResponse.json(matches.map(({ homeTeamCaptainKey: _a, awayTeamCaptainKey: _b, ...m }) => m));
  } catch {
    return NextResponse.json({ error: 'Failed to fetch matches' }, { status: 500 });
  }
}

export async function POST(req) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { seasonId, divisionId, homeTeamId, awayTeamId, week, scheduledAt, format, streamUrl, vodUrl } = body;

  if (!seasonId || !divisionId || !homeTeamId || !awayTeamId || !week) {
    return NextResponse.json({ error: 'seasonId, divisionId, homeTeamId, awayTeamId, week are required' }, { status: 400 });
  }
  if (homeTeamId === awayTeamId) {
    return NextResponse.json({ error: 'homeTeamId and awayTeamId must differ' }, { status: 400 });
  }

  const fmt = format ?? 'BO1';
  if (!FORMAT_GAME_COUNTS[fmt]) {
    return NextResponse.json({ error: 'format must be BO1, BO3, or BO5' }, { status: 400 });
  }

  try {
    const match = await prisma.$transaction(async (tx) => {
      // Both timestamps are set from the same input on creation.
      // defaultScheduledAt is the immutable eligibility-window anchor (§7).
      // scheduledAt is the currently approved play time and may be updated later
      // via an approved RescheduleRequest.
      const anchorDate = scheduledAt ? new Date(scheduledAt) : null;

      const created = await tx.match.create({
        data: {
          seasonId,
          divisionId,
          homeTeamId,
          awayTeamId,
          week: parseInt(week, 10),
          defaultScheduledAt: anchorDate,
          scheduledAt: anchorDate,
          format: fmt,
          streamUrl: streamUrl || null,
          vodUrl: vodUrl || null,
          homeTeamCaptainKey: randomUUID(),
          awayTeamCaptainKey: randomUUID(),
        },
      });

      const gameCount = FORMAT_GAME_COUNTS[fmt];
      await tx.game.createMany({
        data: Array.from({ length: gameCount }, (_, i) => ({
          matchId: created.id,
          gameNumber: i + 1,
        })),
      });

      return created;
    });

    const full = await prisma.match.findUnique({
      where: { id: match.id },
      include: {
        season: { select: { id: true, name: true, slug: true } },
        division: { select: { id: true, name: true } },
        homeTeam: { select: { id: true, name: true, tag: true } },
        awayTeam: { select: { id: true, name: true, tag: true } },
        games: { orderBy: { gameNumber: 'asc' } },
      },
    });

    return NextResponse.json(full, { status: 201 });
  } catch (e) {
    if (e.code === 'P2003') {
      return NextResponse.json({ error: 'Invalid seasonId, divisionId, homeTeamId, or awayTeamId' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create match' }, { status: 500 });
  }
}
