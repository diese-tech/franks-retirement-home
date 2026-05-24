import prisma from '@/lib/db';
import AdminClient from './AdminClient';
import { PUBLIC_DRAFT_SELECT } from '@/lib/draftSelect';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const players = await prisma.player.findMany({ orderBy: { name: 'asc' } });
  const gods = await prisma.god.findMany({ orderBy: { name: 'asc' } });
  // Drafts loaded without *Key fields — share modal fetches keys on demand.
  const drafts = await prisma.draft.findMany({
    orderBy: { createdAt: 'desc' },
    select: PUBLIC_DRAFT_SELECT,
  });
  const seasons = await prisma.season.findMany({
    orderBy: { createdAt: 'desc' },
    include: { divisions: { orderBy: { tier: 'asc' } } },
  });
  const teams = await prisma.team.findMany({
    orderBy: { name: 'asc' },
    include: {
      division: { select: { id: true, name: true, tier: true, seasonId: true } },
      org: { select: { name: true, tag: true } },
      members: {
        where: { leftAt: null },
        orderBy: { joinedAt: 'asc' },
        include: { player: { select: { id: true, name: true, role: true, discordUsername: true } } },
      },
    },
  });
  const matches = await prisma.match.findMany({
    orderBy: [{ week: 'asc' }, { scheduledAt: 'asc' }],
    include: {
      season: { select: { id: true, name: true, slug: true } },
      division: { select: { id: true, name: true } },
      homeTeam: { select: { id: true, name: true, tag: true } },
      awayTeam: { select: { id: true, name: true, tag: true } },
      games: {
        orderBy: { gameNumber: 'asc' },
        include: { draft: { select: { id: true, status: true } } },
      },
    },
  });

  return (
    <AdminClient
      initialPlayers={JSON.parse(JSON.stringify(players))}
      initialGods={JSON.parse(JSON.stringify(gods))}
      initialDrafts={JSON.parse(JSON.stringify(drafts))}
      initialSeasons={JSON.parse(JSON.stringify(seasons))}
      initialTeams={JSON.parse(JSON.stringify(teams))}
      initialMatches={JSON.parse(JSON.stringify(matches))}
    />
  );
}
