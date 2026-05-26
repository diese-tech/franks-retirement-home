import prisma from '@/lib/db';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RetroWindow, PixelBadge, BrutalButton } from '@/components/ui';
import CaptainUploadSection from './CaptainUploadSection';
import CaptainRescheduleSection from './CaptainRescheduleSection';

export const dynamic = 'force-dynamic';

// Returns the teamId the captain key belongs to, or null.
function verifyCaptainKey(match, key) {
  if (!key) return null;
  if (key === match.homeTeamCaptainKey) return match.homeTeamId;
  if (key === match.awayTeamCaptainKey) return match.awayTeamId;
  return null;
}

// Returns 'home' | 'away' | null — used for the reschedule section.
function resolveCaptainSideFromKey(match, key) {
  if (!key) return null;
  if (key === match.homeTeamCaptainKey) return 'home';
  if (key === match.awayTeamCaptainKey) return 'away';
  return null;
}

const STATUS_COLOR = {
  scheduled: 'blue',
  live: 'lime',
  completed: 'purple',
  postponed: 'orange',
};

const ROLE_COLORS = {
  Solo: 'text-orange-400', Jungle: 'text-green-400', Mid: 'text-purple-400',
  Support: 'text-blue-400', Carry: 'text-yellow-400', Fill: 'text-frh-text-muted',
};

function RosterColumn({ team, label }) {
  if (!team) return null;
  const starters = team.members?.filter((m) => !m.isSub) ?? [];
  return (
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-ui uppercase text-frh-text-muted mb-2">{label}</p>
      <p className="font-ui text-base text-frh-text mb-3">
        {team.name}
        <span className="ml-2 font-mono text-[10px] text-frh-text-muted border border-frh-border px-1">[{team.tag}]</span>
      </p>
      {starters.length === 0 ? (
        <p className="text-xs text-frh-text-muted">Roster TBD</p>
      ) : (
        <div className="space-y-1">
          {starters.map((m) => (
            <div key={m.id} className="flex items-center gap-2">
              <span className={`text-[9px] font-mono w-12 shrink-0 ${ROLE_COLORS[m.player.role] ?? 'text-frh-text-muted'}`}>
                {m.player.role}
              </span>
              <span className="text-xs text-frh-text">{m.player.name}</span>
              {m.isCaptain && <span className="text-[9px] text-frh-yellow">&#9733;</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default async function MatchDetailPage({ params, searchParams }) {
  const match = await prisma.match.findUnique({
    where: { id: params.id },
    include: {
      season: { select: { id: true, name: true } },
      division: { select: { id: true, name: true } },
      homeTeam: {
        include: {
          members: {
            where: { leftAt: null },
            orderBy: [{ isCaptain: 'desc' }, { isSub: 'asc' }],
            include: { player: { select: { id: true, name: true, role: true } } },
          },
        },
      },
      awayTeam: {
        include: {
          members: {
            where: { leftAt: null },
            orderBy: [{ isCaptain: 'desc' }, { isSub: 'asc' }],
            include: { player: { select: { id: true, name: true, role: true } } },
          },
        },
      },
      games: {
        orderBy: { gameNumber: 'asc' },
        include: {
          draft: { select: { id: true, status: true } },
        },
      },
    },
  });

  if (!match) notFound();

  const captainKey = searchParams?.key ?? null;
  const captainTeamId = verifyCaptainKey(match, captainKey);
  const captainSide = resolveCaptainSideFromKey(match, captainKey);
  const isLive = match.status === 'live';

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-4">
        <Link href="/schedule" className="text-xs font-ui text-frh-text-muted hover:text-frh-yellow transition-colors uppercase tracking-widest">
          &#8592; Schedule
        </Link>
      </div>

      <RetroWindow title="MATCH FILE" titleBarColor={isLive ? 'lime' : 'yellow'}>
        {/* Match header */}
        <div className="mb-6 border-b-2 border-frh-border pb-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="font-ui text-lg uppercase tracking-widest text-frh-yellow mb-1">
                {match.homeTeam?.name} vs {match.awayTeam?.name}
              </h1>
              <div className="flex items-center gap-2 flex-wrap">
                <PixelBadge label={match.format} color="purple" />
                <PixelBadge label={match.status} color={STATUS_COLOR[match.status] ?? 'gray'} />
                {match.division && <PixelBadge label={match.division.name} color={match.division.name === 'Hospice' ? 'orange' : 'blue'} />}
                {match.season && <span className="text-[10px] text-frh-text-muted">{match.season.name}</span>}
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] text-frh-text-muted font-ui uppercase">Week {match.week}</p>
              {match.scheduledAt ? (
                <>
                  <p className="font-mono text-xs text-frh-text-muted">
                    {new Date(match.scheduledAt).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                  </p>
                  <p className="font-mono text-xs text-frh-text-muted">
                    {new Date(match.scheduledAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </>
              ) : (
                <p className="text-[10px] text-frh-text-muted">Time TBD</p>
              )}
              {match.defaultScheduledAt && (
                <p className="font-mono text-[9px] text-gray-600 mt-1">
                  Window: {new Date(new Date(match.defaultScheduledAt).getTime() - 6*24*60*60*1000).toLocaleDateString()} –{' '}
                  {new Date(new Date(match.defaultScheduledAt).getTime() + 6*24*60*60*1000).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>

          {/* Stream link */}
          {match.streamUrl && (
            <div className="mt-3">
              <a
                href={match.streamUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 border-2 border-frh-lime text-frh-lime font-ui text-xs uppercase px-3 py-1.5 hover:bg-frh-lime/10 transition-colors"
              >
                &#9654; Watch Live
              </a>
            </div>
          )}
          {match.vodUrl && !match.streamUrl && (
            <div className="mt-3">
              <a
                href={match.vodUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 border-2 border-frh-purple text-frh-purple font-ui text-xs uppercase px-3 py-1.5 hover:bg-frh-purple/10 transition-colors"
              >
                &#9654; Watch VOD
              </a>
            </div>
          )}
        </div>

        {/* Rosters */}
        <div className="flex gap-6 mb-8 flex-wrap sm:flex-nowrap">
          <RosterColumn team={match.homeTeam} label="Home" />
          <div className="hidden sm:flex items-center text-frh-text-muted text-xl font-mono self-center">vs</div>
          <RosterColumn team={match.awayTeam} label="Away" />
        </div>

        {/* Games */}
        {match.games.length > 0 && (
          <div>
            <h2 className="font-ui text-xs uppercase tracking-widest text-frh-text-muted mb-3">Games</h2>
            <div className="space-y-2">
              {match.games.map((game) => (
                <div key={game.id} className="flex items-center gap-3 px-3 py-2 border-2 border-frh-border bg-frh-base/40">
                  <span className="font-ui text-xs text-frh-text-muted w-16 shrink-0">Game {game.gameNumber}</span>
                  {game.winnerTeamId ? (
                    <span className="text-xs text-frh-lime font-mono">
                      {game.winnerTeamId === match.homeTeamId ? match.homeTeam?.name : match.awayTeam?.name} won
                    </span>
                  ) : (
                    <span className="text-[10px] text-frh-text-muted">Result pending</span>
                  )}
                  {game.draft && (
                    <Link href={`/draft/${game.draft.id}`} className="ml-auto text-[10px] font-ui text-frh-yellow underline hover:text-frh-orange transition-colors">
                      Draft ({game.draft.status})
                    </Link>
                  )}
                  {!game.draft && (
                    <span className="ml-auto text-[10px] text-frh-text-muted">Draft pending</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {captainTeamId && (
          <CaptainUploadSection
            games={match.games}
            captainKey={captainKey}
          />
        )}

        {captainSide && (
          <CaptainRescheduleSection
            matchId={match.id}
            captainKey={captainKey}
            captainSide={captainSide}
          />
        )}

        <div className="border-t-2 border-frh-border pt-4 mt-6">
          <Link href="/schedule">
            <BrutalButton variant="secondary" size="sm">&#8592; Back to Schedule</BrutalButton>
          </Link>
        </div>
      </RetroWindow>
    </div>
  );
}
