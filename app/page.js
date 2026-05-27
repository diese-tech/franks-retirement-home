import prisma from '@/lib/db';
import { PUBLIC_DRAFT_SELECT } from '@/lib/draftSelect';
import { computeStandings } from '@/lib/standings';
import { mergeWithDefaults } from '@/lib/homepageDefaults';
import HomepageClient from './HomepageClient';

export const dynamic = 'force-dynamic';

/** Build ticker items from real DB data when no admin-authored ticker exists. */
function buildAutoTicker({ recentResults, upcomingMatches, divisionStandings, activeSeason }) {
  const items = [];

  // Recent results
  for (const m of (recentResults ?? []).slice(0, 3)) {
    const homeWins = m.games?.filter(g => g.winnerTeamId === m.homeTeamId).length ?? 0;
    const awayWins = m.games?.filter(g => g.winnerTeamId === m.awayTeamId).length ?? 0;
    const home = m.homeTeam?.name ?? 'Home';
    const away = m.awayTeam?.name ?? 'Away';
    items.push({ tag: 'FINAL', text: `${home} ${homeWins}–${awayWins} ${away}`, tone: 'score' });
  }

  // Upcoming matches
  for (const m of (upcomingMatches ?? []).slice(0, 2)) {
    const home = m.homeTeam?.name ?? 'TBD';
    const away = m.awayTeam?.name ?? 'TBD';
    const div = m.division?.name ? ` · ${m.division.name}` : '';
    items.push({ tag: 'NEXT UP', text: `${home} vs ${away}${div}`, tone: 'info' });
  }

  // League leader note
  const topTeam = divisionStandings?.[0]?.rows?.[0];
  if (topTeam) {
    items.push({ tag: 'STANDINGS', text: `${topTeam.teamName} leads ${divisionStandings[0].division.name} at ${topTeam.wins}–${topTeam.losses}`, tone: 'info' });
  }

  // Season note
  if (activeSeason?.name) {
    items.push({ tag: 'FRH', text: `${activeSeason.name} is live — results, standings and drafts updated in real time`, tone: 'info' });
  }

  return items;
}

export default async function HomePage({ searchParams }) {
  // ── Editorial content: published row (or draft for ?preview=draft admins) ─
  let editableContent = null;
  try {
    // ?preview=draft allows admins to preview their draft before publishing.
    // The route is not protected here by auth — it's low-stakes editorial
    // preview, not a security boundary. Drafts contain no sensitive data.
    const previewDraft = searchParams?.preview === 'draft';
    const contentStatus = previewDraft ? 'draft' : 'published';
    const dbRow = await prisma.homepageContent.findUnique({ where: { status: contentStatus } });
    editableContent = mergeWithDefaults(dbRow); // null-safe: returns defaults if no row
  } catch (err) {
    console.error('[homepage]', err);
    // DB unavailable — fall back to hardcoded defaults (no editableContent = defaults)
  }

  // ── DB-driven structural data ─────────────────────────────────────────────
  let activeSeason = null;
  let liveMatches = [];
  let upcomingMatches = [];
  let recentDrafts = [];
  let playerCount = 0;
  let godCount = 0;
  let matchCount = 0;
  let recentResults = [];
  let divisionStandings = [];

  try {
    activeSeason = await prisma.season.findFirst({
      where: { status: 'active' },
      include: { divisions: { orderBy: { tier: 'desc' } } },
    }) ?? await prisma.season.findFirst({
      orderBy: { createdAt: 'desc' },
      include: { divisions: { orderBy: { tier: 'desc' } } },
    });
  } catch (err) { console.error('[homepage]', err); }

  try {
    [liveMatches, upcomingMatches, recentDrafts, playerCount, godCount, matchCount, recentResults] =
      await Promise.all([
        prisma.match.findMany({
          where: { status: 'live' },
          orderBy: { scheduledAt: 'asc' },
          take: 3,
          include: {
            homeTeam: { select: { id: true, name: true, tag: true, accentColor: true } },
            awayTeam: { select: { id: true, name: true, tag: true, accentColor: true } },
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
          take: 5,
          include: {
            homeTeam: { select: { id: true, name: true, tag: true, accentColor: true } },
            awayTeam: { select: { id: true, name: true, tag: true, accentColor: true } },
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
        prisma.match.count({ where: { status: 'completed' } }),
        prisma.match.findMany({
          where: { status: 'completed' },
          orderBy: { scheduledAt: 'desc' },
          take: 5,
          include: {
            homeTeam: { select: { id: true, name: true, tag: true, accentColor: true } },
            awayTeam: { select: { id: true, name: true, tag: true, accentColor: true } },
            division: { select: { name: true } },
            games: { select: { winnerTeamId: true } },
          },
        }),
      ]);
  } catch (err) { console.error('[homepage]', err); }

  try {
    divisionStandings = activeSeason
      ? await Promise.all(
          activeSeason.divisions.map(async (div) => ({
            division: div,
            rows: (await computeStandings(div.id)).slice(0, 5),
          }))
        )
      : [];
  } catch (err) { console.error('[homepage]', err); }

  // ── Auto-generate ticker items from real data if no admin-authored ticker ─
  // This ensures the ticker is never empty when real match/standings data exists.
  // Admin-authored ticker always takes precedence.
  if (editableContent && editableContent.ticker.length === 0) {
    const autoTicker = buildAutoTicker({ recentResults, upcomingMatches, divisionStandings, activeSeason });
    if (autoTicker.length > 0) {
      editableContent = { ...editableContent, ticker: autoTicker };
    }
  }

  return (
    <HomepageClient
      editableContent={editableContent}
      mode="public"
      activeSeason={JSON.parse(JSON.stringify(activeSeason))}
      liveMatches={JSON.parse(JSON.stringify(liveMatches))}
      upcomingMatches={JSON.parse(JSON.stringify(upcomingMatches))}
      recentDrafts={JSON.parse(JSON.stringify(recentDrafts))}
      divisionStandings={JSON.parse(JSON.stringify(divisionStandings))}
      playerCount={playerCount}
      godCount={godCount}
      matchCount={matchCount}
      recentResults={JSON.parse(JSON.stringify(recentResults))}
    />
  );
}
