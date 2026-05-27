import prisma from '@/lib/db';
import { mergeWithDefaults } from '@/lib/homepageDefaults';
import { computeStandings } from '@/lib/standings';
import { PUBLIC_DRAFT_SELECT } from '@/lib/draftSelect';
import HomepageEditorClient from './HomepageEditorClient';

export const dynamic = 'force-dynamic';

export default async function AdminHomepagePage() {
  // ── Load draft content (falls back to defaults if no draft row exists) ──
  let draftRow = null;
  try {
    draftRow = await prisma.homepageContent.findUnique({ where: { status: 'draft' } });
  } catch (_) {}

  let publishedRow = null;
  try {
    publishedRow = await prisma.homepageContent.findUnique({ where: { status: 'published' } });
  } catch (_) {}

  const initialContent = mergeWithDefaults(draftRow);

  // ── Load the same DB-driven props used by the public homepage ──────────
  let activeSeason = null;
  let liveMatches = [];
  let upcomingMatches = [];
  let recentDrafts = [];
  let playerCount = 0;
  let matchCount = 0;
  let divisionStandings = [];
  let recentResults = [];

  try {
    activeSeason = await prisma.season.findFirst({
      where: { status: 'active' },
      include: { divisions: { orderBy: { tier: 'desc' } } },
    }) ?? await prisma.season.findFirst({
      orderBy: { createdAt: 'desc' },
      include: { divisions: { orderBy: { tier: 'desc' } } },
    });
  } catch (_) {}

  try {
    [liveMatches, upcomingMatches, recentDrafts, playerCount, matchCount, recentResults] = await Promise.all([
      prisma.match.findMany({
        where: { status: 'live' }, orderBy: { scheduledAt: 'asc' }, take: 3,
        include: {
          homeTeam: { select: { id: true, name: true, tag: true, accentColor: true } },
          awayTeam: { select: { id: true, name: true, tag: true, accentColor: true } },
          division: { select: { name: true } },
          games: { orderBy: { gameNumber: 'asc' }, include: { draft: { select: { id: true, status: true } } } },
        },
      }),
      prisma.match.findMany({
        where: { status: 'scheduled' }, orderBy: [{ week: 'asc' }, { scheduledAt: 'asc' }], take: 5,
        include: {
          homeTeam: { select: { id: true, name: true, tag: true, accentColor: true } },
          awayTeam: { select: { id: true, name: true, tag: true, accentColor: true } },
          division: { select: { name: true } },
        },
      }),
      prisma.draft.findMany({
        where: { status: { in: ['lobby', 'banning', 'picking'] } },
        orderBy: { createdAt: 'desc' }, take: 3,
        select: PUBLIC_DRAFT_SELECT,
      }),
      prisma.player.count(),
      prisma.match.count({ where: { status: 'completed' } }),
      prisma.match.findMany({
        where: { status: 'completed' },
        orderBy: { scheduledAt: 'desc' },
        take: 5,
        include: {
          homeTeam: { select: { id: true, name: true, tag: true, accentColor: true } },
          awayTeam: { select: { id: true, name: true, tag: true, accentColor: true } },
          division: { select: { name: true } },
        },
      }),
    ]);
  } catch (_) {}

  try {
    divisionStandings = activeSeason
      ? await Promise.all(
          activeSeason.divisions.map(async (div) => ({
            division: div,
            rows: (await computeStandings(div.id)).slice(0, 5),
          }))
        )
      : [];
  } catch (_) {}

  return (
    <HomepageEditorClient
      initialContent={JSON.parse(JSON.stringify(initialContent))}
      hasDraft={!!draftRow}
      hasPublished={!!publishedRow}
      publishedAt={publishedRow?.publishedAt ? publishedRow.publishedAt.toISOString() : null}
      savedAt={draftRow?.savedAt ? draftRow.savedAt.toISOString() : null}
      // DB-driven homepage props (passed through to HomepageClient)
      activeSeason={JSON.parse(JSON.stringify(activeSeason))}
      liveMatches={JSON.parse(JSON.stringify(liveMatches))}
      upcomingMatches={JSON.parse(JSON.stringify(upcomingMatches))}
      recentDrafts={JSON.parse(JSON.stringify(recentDrafts))}
      divisionStandings={JSON.parse(JSON.stringify(divisionStandings))}
      playerCount={playerCount}
      matchCount={matchCount}
      recentResults={JSON.parse(JSON.stringify(recentResults))}
    />
  );
}
