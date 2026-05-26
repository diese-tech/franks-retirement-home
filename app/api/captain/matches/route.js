import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import {
  getDiscordSessionUser,
  hasDiscordCaptainRole,
  resolveTeamFromRoles,
} from '@/lib/discordAuth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const session = getDiscordSessionUser(request);
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  if (!hasDiscordCaptainRole(session.roles)) {
    return NextResponse.json({ error: 'Captain role required' }, { status: 403 });
  }

  const teamId = resolveTeamFromRoles(session.roles);
  if (!teamId) {
    return NextResponse.json({ error: 'No team role found' }, { status: 403 });
  }

  const matches = await prisma.match.findMany({
    where: {
      OR: [
        { homeTeamId: teamId },
        { awayTeamId: teamId },
      ],
    },
    include: {
      season: true,
      division: true,
      homeTeam: { select: { id: true, name: true, tag: true } },
      awayTeam: { select: { id: true, name: true, tag: true } },
      games: {
        orderBy: { gameNumber: 'asc' },
        include: {
          draft: { select: { id: true, status: true } },
        },
      },
    },
    orderBy: { scheduledAt: 'desc' },
    take: 20,
  });

  const result = matches.map((match) => ({
    ...match,
    captainSide: match.homeTeamId === teamId ? 'home' : 'away',
  }));

  return NextResponse.json(result);
}
