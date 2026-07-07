import prisma from '@/lib/db';
import AdminClient from './AdminClient';
import PasswordGate from './PasswordGate';
import { PUBLIC_DRAFT_SELECT } from '@/lib/draftSelect';
import { isAdminFromCookies } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  // Server-side gate: no admin session (Discord admin or password cookie)
  // means no data is fetched or serialized into the RSC payload.
  let isAdmin = false;
  try { isAdmin = isAdminFromCookies(); } catch { /* cookies() may throw outside request context */ }
  if (!isAdmin) return <PasswordGate />;

  let data = null;
  try {
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
    const playerDrafts = await prisma.playerDraft.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        season: { select: { id: true, name: true } },
        division: { select: { id: true, name: true } },
        picks: { select: { id: true } },
      },
    });
    const activeSeason = await prisma.season.findFirst({ where: { status: 'active' } });
    const [liveMatchCount, pendingSubCount, teamCount] = await Promise.all([
      prisma.match.count({ where: { status: 'live' } }),
      prisma.matchSubmission.count({ where: { status: { in: ['pending', 'in_review'] } } }),
      prisma.team.count(),
    ]);

    const pendingSubmissions = await prisma.matchSubmission.findMany({
      where: { status: { in: ['pending', 'in_review'] } },
      orderBy: { createdAt: 'asc' },
      include: {
        attachments: { select: { id: true, kind: true, url: true } },
        match: {
          select: {
            id: true,
            week: true,
            homeTeam: { select: { id: true, name: true, tag: true } },
            awayTeam: { select: { id: true, name: true, tag: true } },
          },
        },
        game: { select: { id: true, gameNumber: true } },
      },
    });

    data = { players, gods, drafts, seasons, teams, matches, playerDrafts, pendingSubmissions, activeSeason, liveMatchCount, pendingSubCount, teamCount };
  } catch (err) { console.error('[admin]', err); }

  if (data === null) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="border-2 border-red-700 bg-frh-base p-6 text-center">
          <h1 className="font-ui text-xl uppercase tracking-widest text-red-400 mb-2">Admin Panel</h1>
          <p className="text-sm text-frh-text-muted mb-4">Database unreachable. Unable to load admin data.</p>
          <a href="/" className="text-xs font-ui text-frh-yellow hover:underline uppercase tracking-widest">&larr; Back to Home</a>
        </div>
      </div>
    );
  }

  const { players, gods, drafts, seasons, teams, matches, playerDrafts, pendingSubmissions, activeSeason, liveMatchCount, pendingSubCount, teamCount } = data;

  return (
    <AdminClient
      initialPlayers={JSON.parse(JSON.stringify(players))}
      initialGods={JSON.parse(JSON.stringify(gods))}
      initialDrafts={JSON.parse(JSON.stringify(drafts))}
      initialSeasons={JSON.parse(JSON.stringify(seasons))}
      initialTeams={JSON.parse(JSON.stringify(teams))}
      initialMatches={JSON.parse(JSON.stringify(matches))}
      initialPlayerDrafts={JSON.parse(JSON.stringify(playerDrafts))}
      initialSubmissions={JSON.parse(JSON.stringify(pendingSubmissions))}
      overview={{ liveMatchCount, pendingSubCount, teamCount, playerCount: players.length, godCount: gods.length, seasonName: activeSeason?.name ?? null, currentWeek: activeSeason?.currentWeek ?? null }}
    />
  );
}
