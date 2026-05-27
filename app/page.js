import prisma from '@/lib/db';
import { PUBLIC_DRAFT_SELECT } from '@/lib/draftSelect';
import { computeStandings } from '@/lib/standings';
import { mergeWithDefaults } from '@/lib/homepageDefaults';
import HomepageClient from './HomepageClient';

export const dynamic = 'force-dynamic';

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
  } catch (_) {
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
  } catch (_) {}

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
