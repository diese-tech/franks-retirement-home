import prisma from '@/lib/db';
import { PUBLIC_DRAFT_SELECT } from '@/lib/draftSelect';
import { computeStandings } from '@/lib/standings';
import HomepageClient from './HomepageClient';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const activeSeason = await prisma.season.findFirst({
    where: { status: 'active' },
    include: { divisions: { orderBy: { tier: 'desc' } } },
  }) ?? await prisma.season.findFirst({
    orderBy: { createdAt: 'desc' },
    include: { divisions: { orderBy: { tier: 'desc' } } },
  });

  const [liveMatches, upcomingMatches, recentDrafts, playerCount, godCount] = await Promise.all([
    prisma.match.findMany({
      where: { status: 'live' },
      orderBy: { scheduledAt: 'asc' },
      take: 3,
      include: {
        homeTeam: { select: { id: true, name: true, tag: true } },
        awayTeam: { select: { id: true, name: true, tag: true } },
        division: { select: { name: true } },
        games: {
          orderBy: { gameNumber: 'asc' },
          include: { draft: { select: { id: true, status: true } } },
        },
      },
    }),
    prisma.match.findMany({
      where: { status: 'scheduled' },
      orderBy: [{ week: 'asc' }, { scheduledAt: 'asc' }],
      take: 4,
      include: {
        homeTeam: { select: { id: true, name: true, tag: true } },
        awayTeam: { select: { id: true, name: true, tag: true } },
        division: { select: { name: true } },
      },
    }),
    prisma.draft.findMany({
      where: { status: { in: ['lobby', 'banning', 'picking'] } },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: PUBLIC_DRAFT_SELECT,
    }),
    prisma.player.count(),
    prisma.god.count(),
  ]);

  const divisionStandings = activeSeason
    ? await Promise.all(
        activeSeason.divisions.map(async (div) => ({
          division: div,
          rows: (await computeStandings(div.id)).slice(0, 5),
        }))
      )
    : [];

  return (
    <HomepageClient
      activeSeason={JSON.parse(JSON.stringify(activeSeason))}
      liveMatches={JSON.parse(JSON.stringify(liveMatches))}
      upcomingMatches={JSON.parse(JSON.stringify(upcomingMatches))}
      recentDrafts={JSON.parse(JSON.stringify(recentDrafts))}
      divisionStandings={JSON.parse(JSON.stringify(divisionStandings))}
      playerCount={playerCount}
      godCount={godCount}
    />
  );
}
