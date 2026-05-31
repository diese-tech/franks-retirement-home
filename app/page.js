import prisma from '@/lib/db';
import { PUBLIC_DRAFT_SELECT } from '@/lib/draftSelect';
import { computeStandings } from '@/lib/standings';
import { mergeWithDefaults } from '@/lib/homepageDefaults';
import { isDiscordAdminFromCookies, hasDiscordSession } from '@/lib/serverAuth';
import HomepageWrapper from './HomepageWrapper';

export const dynamic = 'force-dynamic';

function formatHomepageCaseTime(value) {
  if (!value) return 'just now';

  const then = new Date(value).getTime();
  const diffMs = Date.now() - then;
  if (!Number.isFinite(diffMs) || diffMs < 0) return 'just now';

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return days === 1 ? 'yesterday' : `${days}d ago`;
}

function formatBulletinTag(type) {
  return ({
    announcement: 'PSA',
    match_hype: 'HYPE',
    player_spotlight: 'STAR',
    team_roast: 'ROAST',
    weekly_recap: 'RECAP',
  })[type] || 'POST';
}

function truncateText(value, max = 120) {
  const text = (value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}...`;
}

function applyBulletinPostsToHomepage(content, posts) {
  if (!content || !Array.isArray(posts) || posts.length === 0) return content;

  const bulletin = posts.map(post => ({
    tag: formatBulletinTag(post.type),
    user: post.createdById || post.relatedPlayer?.name || post.relatedTeam?.tag || 'FRH',
    title: post.title,
    replies: post._count?.comments || 0,
    hot: !!post.pinned || (post._count?.reactions || 0) >= 3,
    href: '/bulletin-board',
    time: formatHomepageCaseTime(post.publishedAt || post.createdAt),
  }));

  return { ...content, bulletin: bulletin.slice(0, 6) };
}

function applyEditorialCasesToHomepage(content, cases) {
  if (!content || !Array.isArray(cases)) return content;

  const fraudWatch = cases
    .filter(c => c.type === 'fraud_watch')
    .map(c => ({
      player: c.relatedPlayer?.name || c.title,
      team: c.relatedTeam?.tag || 'FA',
      charge: c.charge || c.body || c.title,
      level: Math.min(3, Math.max(1, c.severity || 2)),
      href: '/fraud-watch',
    }));

  const washedReports = cases
    .filter(c => c.type === 'washed_report')
    .map(c => ({
      who: c.relatedPlayer?.name || c.title,
      what: c.charge || c.body || c.title,
      time: formatHomepageCaseTime(c.publishedAt || c.createdAt),
      href: '/fraud-watch',
    }));

  return {
    ...content,
    fraudWatch: fraudWatch.length ? fraudWatch.slice(0, 4) : content.fraudWatch,
    washedReports: washedReports.length ? washedReports.slice(0, 8) : content.washedReports,
  };
}

function applyBettingLinesToHomepage(content, lines) {
  if (!content || !Array.isArray(lines) || lines.length === 0) return content;

  const knowsBall = lines.map(line => {
    const favorite = line.teamAOdds <= line.teamBOdds ? line.teamA : line.teamB;
    const odds = line.teamAOdds <= line.teamBOdds ? line.teamAOdds : line.teamBOdds;
    const opponent = favorite.id === line.teamA.id ? line.teamB : line.teamA;
    return {
      who: 'Knows Ball',
      line: `${favorite.tag || favorite.name} over ${opponent.tag || opponent.name} (${odds > 0 ? '+' : ''}${odds})`,
      conf: Math.max(50, Math.min(95, 100 - Math.abs(odds) / 4)),
      href: '/knows-ball',
    };
  });

  return { ...content, knowsBall: knowsBall.slice(0, 4) };
}

function applyMatchRivalriesToHomepage(content, matches) {
  if (!content || !Array.isArray(matches) || matches.length === 0) return content;

  const rivalries = matches.slice(0, 3).map(match => ({
    title: `Week ${match.week} Collision`,
    teams: [match.homeTeam.name, match.awayTeam.name],
    tags: [match.homeTeam.tag, match.awayTeam.tag],
    colors: [match.homeTeam.accentColor || '#cc3300', match.awayTeam.accentColor || '#2b5ba8'],
    record: 'Upcoming',
    note: `${match.division?.name || 'League'} match${match.scheduledAt ? ` on ${new Date(match.scheduledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}.`,
    href: `/matches/${match.id}`,
  }));

  return { ...content, rivalries };
}

function applySocialCardsToHomepage(content, { posts = [], cases = [], lines = [], recentResults = [] }) {
  if (!content) return content;

  const cards = [];

  for (const post of posts.slice(0, 2)) {
    cards.push({
      kind: post.pinned ? 'STAT' : 'QUOTE',
      title: formatBulletinTag(post.type),
      unit: post.title,
      caption: `${post._count?.comments || 0} replies on Bulletin Board`,
      href: '/bulletin-board',
    });
  }

  for (const c of cases.slice(0, 2)) {
    cards.push({
      kind: c.type === 'fraud_watch' ? 'MEME' : 'STAT',
      title: c.type === 'fraud_watch' ? 'FRAUD WATCH' : 'WASHED',
      unit: c.relatedPlayer?.name || c.title,
      caption: truncateText(c.charge || c.body || c.title, 70),
      href: '/fraud-watch',
    });
  }

  for (const line of lines.slice(0, 1)) {
    cards.push({
      kind: 'STAT',
      title: 'OPEN LINE',
      unit: `${line.teamA.tag || line.teamA.name} vs ${line.teamB.tag || line.teamB.name}`,
      caption: 'Live on Knows Ball',
      href: '/knows-ball',
    });
  }

  for (const result of recentResults.slice(0, 1)) {
    cards.push({
      kind: 'STAT',
      title: 'FINAL',
      unit: `${result.homeTeam.tag} vs ${result.awayTeam.tag}`,
      caption: result.division?.name || 'Recent result',
      href: `/matches/${result.id}`,
    });
  }

  return cards.length ? { ...content, socialCards: cards.slice(0, 6) } : content;
}

function applyTickerToHomepage(content, { posts = [], cases = [], lines = [], upcomingMatches = [], recentResults = [] }) {
  if (!content) return content;

  const ticker = [];

  for (const result of recentResults.slice(0, 3)) {
    ticker.push({
      tag: 'FINAL',
      text: `${result.homeTeam.tag} vs ${result.awayTeam.tag} is final`,
      tone: 'score',
    });
  }

  for (const match of upcomingMatches.slice(0, 3)) {
    ticker.push({
      tag: 'NEXT',
      text: `${match.homeTeam.tag} vs ${match.awayTeam.tag}${match.week ? ` in Week ${match.week}` : ''}`,
      tone: 'info',
    });
  }

  for (const post of posts.slice(0, 3)) {
    ticker.push({
      tag: formatBulletinTag(post.type),
      text: post.title,
      tone: post.pinned ? 'alert' : 'info',
    });
  }

  for (const c of cases.filter(item => item.type === 'fraud_watch').slice(0, 2)) {
    ticker.push({
      tag: 'FRAUD',
      text: `${c.relatedPlayer?.name || c.title}: ${truncateText(c.charge || c.body || c.title, 80)}`,
      tone: 'alert',
    });
  }

  for (const line of lines.slice(0, 2)) {
    ticker.push({
      tag: 'LINE',
      text: `${line.teamA.tag || line.teamA.name} ${line.teamAOdds > 0 ? '+' : ''}${line.teamAOdds} / ${line.teamB.tag || line.teamB.name} ${line.teamBOdds > 0 ? '+' : ''}${line.teamBOdds}`,
      tone: 'score',
    });
  }

  return ticker.length ? { ...content, ticker: ticker.slice(0, 8) } : content;
}

export default async function HomePage({ searchParams }) {
  // ── Discord admin check — determines whether to render editor mode ─────────
  let isAdmin = false;
  try { isAdmin = isDiscordAdminFromCookies(); } catch { /* cookies() may throw outside request context */ }
  const forcePublicPreview = isAdmin && searchParams?.preview === 'draft';

  // ── Editorial content ──────────────────────────────────────────────────────
  // Admins always see the draft (so they edit the pre-publish version).
  // Non-admins see published content. ?preview=draft is gated behind a Discord
  // session to avoid exposing drafts to anonymous users.
  let editableContent = null;
  let hasDraft = false;
  let hasPublished = false;
  let savedAt = null;
  let publishedAt = null;
  let liveBulletinPosts = [];
  let liveEditorialCases = [];
  let liveBettingLines = [];
  try {
    if (isAdmin && !forcePublicPreview) {
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
      const previewDraft = searchParams?.preview === 'draft' && (isAdmin || sessionExists);
      const contentStatus = previewDraft ? 'draft' : 'published';
      const dbRow = await prisma.homepageContent.findUnique({ where: { status: contentStatus } });
      editableContent = mergeWithDefaults(dbRow);
    }
  } catch (err) {
    console.error('[homepage]', err);
  }

  try {
    liveBulletinPosts = await prisma.bulletinPost.findMany({
      where: { status: 'published' },
      orderBy: [{ pinned: 'desc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 6,
      include: {
        relatedPlayer: { select: { name: true } },
        relatedTeam: { select: { tag: true } },
        _count: { select: { comments: true, reactions: true } },
      },
    });
    editableContent = applyBulletinPostsToHomepage(editableContent, liveBulletinPosts);
  } catch (err) {
    console.error('[homepage/bulletin]', err);
  }

  try {
    liveEditorialCases = await prisma.editorialCase.findMany({
      where: {
        status: 'published',
        type: { in: ['fraud_watch', 'washed_report'] },
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 12,
      include: {
        relatedPlayer: { select: { name: true } },
        relatedTeam: { select: { tag: true } },
      },
    });
    editableContent = applyEditorialCasesToHomepage(editableContent, liveEditorialCases);
  } catch (err) {
    console.error('[homepage/editorial-cases]', err);
  }

  try {
    liveBettingLines = await prisma.bettingLine.findMany({
      where: { status: 'open' },
      orderBy: { createdAt: 'desc' },
      take: 4,
      include: {
        teamA: { select: { id: true, name: true, tag: true } },
        teamB: { select: { id: true, name: true, tag: true } },
      },
    });
    editableContent = applyBettingLinesToHomepage(editableContent, liveBettingLines);
  } catch (err) {
    console.error('[homepage/betting-lines]', err);
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
    const [
      liveMatchesResult,
      upcomingMatchesResult,
      recentDraftsResult,
      playerCountResult,
      godCountResult,
      matchCountResult,
      recentResultsResult,
    ] = await Promise.allSettled([
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

    if (liveMatchesResult.status === 'fulfilled') liveMatches = liveMatchesResult.value;
    if (upcomingMatchesResult.status === 'fulfilled') upcomingMatches = upcomingMatchesResult.value;
    if (recentDraftsResult.status === 'fulfilled') recentDrafts = recentDraftsResult.value;
    if (playerCountResult.status === 'fulfilled') playerCount = playerCountResult.value;
    if (godCountResult.status === 'fulfilled') godCount = godCountResult.value;
    if (matchCountResult.status === 'fulfilled') matchCount = matchCountResult.value;
    if (recentResultsResult.status === 'fulfilled') recentResults = recentResultsResult.value;

    for (const result of [liveMatchesResult, upcomingMatchesResult, recentDraftsResult, playerCountResult, godCountResult, matchCountResult, recentResultsResult]) {
      if (result.status === 'rejected') console.error('[homepage/data]', result.reason);
    }
  } catch (err) { console.error('[homepage]', err); }

  editableContent = applyMatchRivalriesToHomepage(editableContent, upcomingMatches);
  editableContent = applySocialCardsToHomepage(editableContent, {
    posts: liveBulletinPosts,
    cases: liveEditorialCases,
    lines: liveBettingLines,
    recentResults,
  });
  editableContent = applyTickerToHomepage(editableContent, {
    posts: liveBulletinPosts,
    cases: liveEditorialCases,
    lines: liveBettingLines,
    upcomingMatches,
    recentResults,
  });

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
      forcePublicPreview={forcePublicPreview}
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
