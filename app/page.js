import prisma from '@/lib/db';
import { PUBLIC_DRAFT_SELECT } from '@/lib/draftSelect';
import { computeStandings } from '@/lib/standings';
import { mergeWithDefaults } from '@/lib/homepageDefaults';
import { isDiscordAdminFromCookies, hasDiscordSession } from '@/lib/serverAuth';
import HomepageWrapper from './HomepageWrapper';

export const dynamic = 'force-dynamic';

export default async function HomePage({ searchParams }) {
  // ── Discord admin check — determines whether to render editor mode ─────────
  let isAdmin = false;
  try { isAdmin = isDiscordAdminFromCookies(); } catch { /* cookies() may throw outside request context */ }

  // ── Editorial content ──────────────────────────────────────────────────────
  // Admins always see the draft (so they edit the pre-publish version).
  // Non-admins see published content. ?preview=draft is gated behind a Discord
  // session to avoid exposing drafts to anonymous users.
  let editableContent = null;
  let hasDraft = false;
  let hasPublished = false;
  let savedAt = null;
  let publishedAt = null;
  try {
    if (isAdmin) {
      const rows = await prisma.homepageContent.findMany({
        where: { status: { in: ['draft', 'published'] } },
      });
      const draftRow = rows.find(r => r.status === 'draft') ?? null;
      const publishedRow = rows.find(r => r.status === 'published') ?? null;
      hasDraft = !!draftRow;
      hasPublished = !!publishedRow;
      savedAt = draftRow?.savedAt?.toISOString() ?? null;
      publishedAt = publishedRow?.publishedAt?.toISOString() ?? null;
      editableContent = mergeWithDefaults(draftRow ?? publishedRow);
    } else {
      let sessionExists = false;
      try { sessionExists = hasDiscordSession(); } catch {}
      const previewDraft = !isAdmin && sessionExists && searchParams?.preview === 'draft';
      const contentStatus = previewDraft ? 'draft' : 'published';
      const dbRow = await prisma.homepageContent.findUnique({ where: { status: contentStatus } });
      editableContent = mergeWithDefaults(dbRow);
    }
  } catch (err) {
    console.error('[homepage]', err);
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

  return (
    <HomepageWrapper
      isAdmin={isAdmin}
      editableContent={editableContent}
      hasDraft={hasDraft}
      hasPublished={hasPublished}
      savedAt={savedAt}
      publishedAt={publishedAt}
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
