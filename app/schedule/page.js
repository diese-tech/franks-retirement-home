import prisma from '@/lib/db';
import Link from 'next/link';
import { RetroWindow, PixelBadge } from '@/components/ui';

export const revalidate = 60;

const STATUS_COLOR = {
  scheduled: 'blue',
  live: 'lime',
  completed: 'purple',
  postponed: 'orange',
};

function MatchRow({ match }) {
  const isLive = match.status === 'live';
  return (
    <Link href={`/matches/${match.id}`} className="block group">
      <div className={`border-2 transition-colors p-3 bg-frh-surface/40 ${isLive ? 'border-frh-lime animate-pulse-slow' : 'border-frh-border group-hover:border-frh-yellow/50'}`}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-ui text-sm text-frh-text group-hover:text-frh-yellow transition-colors">
                {match.homeTeam?.name} <span className="text-frh-text-muted text-xs">vs</span> {match.awayTeam?.name}
              </span>
              <PixelBadge label={match.format} color="purple" />
              <PixelBadge label={match.status} color={STATUS_COLOR[match.status] ?? 'gray'} />
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {match.scheduledAt ? (
                <span className="text-[10px] text-frh-text-muted font-mono">
                  {new Date(match.scheduledAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                  {' '}
                  {new Date(match.scheduledAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                </span>
              ) : (
                <span className="text-[10px] text-frh-text-muted">TBD</span>
              )}
              {match.division && (
                <span className="text-[10px] text-frh-text-muted">{match.division.name}</span>
              )}
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            {match.streamUrl && (
              <PixelBadge label="Watch" color="lime" />
            )}
            {match.status === 'completed' && match.games?.some((g) => g.winnerTeamId) && (
              <PixelBadge label="Result in" color="purple" />
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default async function SchedulePage({ searchParams }) {
  const weekFilter = searchParams?.week ? parseInt(searchParams.week, 10) : null;
  const statusFilter = searchParams?.status ?? null;

  let activeSeason = null;
  let matches = null;
  try {
    activeSeason = await prisma.season.findFirst({
      where: { status: 'active' },
    }) ?? await prisma.season.findFirst({ orderBy: { createdAt: 'desc' } });

    const where = {};
    if (activeSeason) where.seasonId = activeSeason.id;
    if (weekFilter) where.week = weekFilter;
    if (statusFilter) where.status = statusFilter;

    matches = await prisma.match.findMany({
      where,
      orderBy: [{ week: 'asc' }, { scheduledAt: 'asc' }],
      include: {
        division: { select: { id: true, name: true } },
        homeTeam: { select: { id: true, name: true, tag: true } },
        awayTeam: { select: { id: true, name: true, tag: true } },
        games: { select: { id: true, gameNumber: true, winnerTeamId: true } },
      },
    });
  } catch (err) { console.error('[schedule]', err); }

  if (matches === null) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <RetroWindow title="SCHEDULE.EXE" titleBarColor="yellow">
          <div className="text-center py-12">
            <p className="text-sm text-frh-text-muted mb-4">Schedule data unavailable. Database may be unreachable.</p>
            <a href="/" className="text-xs font-ui text-frh-yellow hover:underline uppercase tracking-widest">&larr; Back to Home</a>
          </div>
        </RetroWindow>
      </div>
    );
  }

  const liveMatches = matches.filter((m) => m.status === 'live');
  const upcomingMatches = matches.filter((m) => m.status === 'scheduled');
  const pastMatches = matches.filter((m) => m.status === 'completed' || m.status === 'postponed');

  const weeks = [...new Set(matches.map((m) => m.week))].sort((a, b) => a - b);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <RetroWindow title="SCHEDULE.EXE" titleBarColor="yellow">
        <div className="flex items-start justify-between gap-4 mb-6 border-b-2 border-frh-border pb-4">
          <div>
            <h1 className="font-ui text-xl uppercase tracking-widest text-frh-yellow mb-1">Schedule</h1>
            {activeSeason && (
              <p className="text-sm text-frh-text-muted">{activeSeason.name} — {matches.length} match{matches.length !== 1 ? 'es' : ''}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Link href="/schedule" className={`text-[10px] font-ui uppercase px-3 py-2 border transition-colors min-h-[36px] flex items-center ${!statusFilter && !weekFilter ? 'border-frh-yellow text-frh-yellow' : 'border-frh-border text-frh-text-muted hover:border-frh-text'}`}>All</Link>
            {['live', 'scheduled', 'completed'].map((s) => (
              <Link key={s} href={`/schedule?status=${s}`} className={`text-[10px] font-ui uppercase px-3 py-2 border transition-colors min-h-[36px] flex items-center ${statusFilter === s ? 'border-frh-yellow text-frh-yellow' : 'border-frh-border text-frh-text-muted hover:border-frh-text'}`}>
                {s}
              </Link>
            ))}
          </div>
        </div>

        {/* Week filter chips */}
        {weeks.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {weeks.map((w) => (
              <Link key={w} href={`/schedule?week=${w}`} className={`text-[10px] font-ui uppercase px-3 py-2 border transition-colors min-h-[36px] flex items-center ${weekFilter === w ? 'border-frh-yellow text-frh-yellow' : 'border-frh-border text-frh-text-muted hover:border-frh-text'}`}>
                Wk {w}
              </Link>
            ))}
          </div>
        )}

        {matches.length === 0 ? (
          <p className="text-sm text-frh-text-muted text-center py-8">
            {statusFilter || weekFilter ? 'No matches match your filters.' : 'No matches scheduled yet. Probably recovering from last season.'}
          </p>
        ) : (
          <div className="space-y-8">
            {liveMatches.length > 0 && (
              <div>
                <h2 className="font-ui text-xs uppercase tracking-widest text-frh-lime mb-2">&#9679; Live Now</h2>
                <div className="space-y-2">{liveMatches.map((m) => <MatchRow key={m.id} match={m} />)}</div>
              </div>
            )}
            {upcomingMatches.length > 0 && (
              <div>
                <h2 className="font-ui text-xs uppercase tracking-widest text-frh-text-muted mb-2">Upcoming</h2>
                {weekFilter ? (
                  <div className="space-y-2">{upcomingMatches.map((m) => <MatchRow key={m.id} match={m} />)}</div>
                ) : (
                  [...new Set(upcomingMatches.map((m) => m.week))].sort((a, b) => a - b).map((week) => (
                    <div key={week} className="mb-4">
                      <p className="text-[10px] font-ui uppercase text-frh-text-muted mb-2">Week {week}</p>
                      <div className="space-y-2">
                        {upcomingMatches.filter((m) => m.week === week).map((m) => <MatchRow key={m.id} match={m} />)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
            {pastMatches.length > 0 && (
              <div>
                <h2 className="font-ui text-xs uppercase tracking-widest text-frh-text-muted mb-2">Past</h2>
                <div className="space-y-2">{pastMatches.map((m) => <MatchRow key={m.id} match={m} />)}</div>
              </div>
            )}
          </div>
        )}
      </RetroWindow>
    </div>
  );
}
