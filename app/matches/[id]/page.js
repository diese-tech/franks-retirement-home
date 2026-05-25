import prisma from '@/lib/db';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RetroWindow, PixelBadge, BrutalButton } from '@/components/ui';

export const dynamic = 'force-dynamic';

const STATUS_COLOR = {
  scheduled: 'blue',
  live: 'lime',
  completed: 'purple',
  postponed: 'orange',
};

const ROLE_COLORS = {
  Solo: 'text-orange-400', Jungle: 'text-green-400', Mid: 'text-purple-400',
  Support: 'text-blue-400', Carry: 'text-yellow-400', Fill: 'text-gray-400',
};

function RosterColumn({ team, label }) {
  if (!team) return null;
  const starters = team.members?.filter((m) => !m.isSub) ?? [];
  return (
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-ui uppercase text-gray-600 mb-2">{label}</p>
      <p className="font-ui text-base text-gray-200 mb-3">
        {team.name}
        <span className="ml-2 font-mono text-[10px] text-gray-600 border border-brand-600 px-1">[{team.tag}]</span>
      </p>
      {starters.length === 0 ? (
        <p className="text-xs text-gray-700">Roster TBD</p>
      ) : (
        <div className="space-y-1">
          {starters.map((m) => (
            <div key={m.id} className="flex items-center gap-2">
              <span className={`text-[9px] font-mono w-12 shrink-0 ${ROLE_COLORS[m.player.role] ?? 'text-gray-500'}`}>
                {m.player.role}
              </span>
              <span className="text-xs text-gray-300">{m.player.name}</span>
              {m.isCaptain && <span className="text-[9px] text-frh-yellow">&#9733;</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default async function MatchDetailPage({ params }) {
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

  // Strip captain keys — not returned from this public route
  const isLive = match.status === 'live';

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-4">
        <Link href="/schedule" className="text-xs font-ui text-gray-600 hover:text-frh-yellow transition-colors uppercase tracking-widest">
          &#8592; Schedule
        </Link>
      </div>

      <RetroWindow title="MATCH FILE" titleBarColor={isLive ? 'lime' : 'yellow'}>
        {/* Match header */}
        <div className="mb-6 border-b-2 border-brand-700 pb-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="font-ui text-lg uppercase tracking-widest text-frh-yellow mb-1">
                {match.homeTeam?.name} vs {match.awayTeam?.name}
              </h1>
              <div className="flex items-center gap-2 flex-wrap">
                <PixelBadge label={match.format} color="purple" />
                <PixelBadge label={match.status} color={STATUS_COLOR[match.status] ?? 'gray'} />
                {match.division && <PixelBadge label={match.division.name} color={match.division.name === 'Hospice' ? 'orange' : 'blue'} />}
                {match.season && <span className="text-[10px] text-gray-600">{match.season.name}</span>}
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] text-gray-600 font-ui uppercase">Week {match.week}</p>
              {match.scheduledAt ? (
                <>
                  <p className="font-mono text-xs text-gray-400">
                    {new Date(match.scheduledAt).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                  </p>
                  <p className="font-mono text-xs text-gray-500">
                    {new Date(match.scheduledAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </>
              ) : (
                <p className="text-[10px] text-gray-600">Time TBD</p>
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
          <div className="hidden sm:flex items-center text-gray-700 text-xl font-mono self-center">vs</div>
          <RosterColumn team={match.awayTeam} label="Away" />
        </div>

        {/* Games */}
        {match.games.length > 0 && (
          <div>
            <h2 className="font-ui text-xs uppercase tracking-widest text-gray-500 mb-3">Games</h2>
            <div className="space-y-2">
              {match.games.map((game) => (
                <div key={game.id} className="flex items-center gap-3 px-3 py-2 border-2 border-brand-700 bg-brand-950/40">
                  <span className="font-ui text-xs text-gray-500 w-16 shrink-0">Game {game.gameNumber}</span>
                  {game.winnerTeamId ? (
                    <span className="text-xs text-frh-lime font-mono">
                      {game.winnerTeamId === match.homeTeamId ? match.homeTeam?.name : match.awayTeam?.name} won
                    </span>
                  ) : (
                    <span className="text-[10px] text-gray-700">Result pending</span>
                  )}
                  {game.draft && (
                    <Link href={`/draft/${game.draft.id}`} className="ml-auto text-[10px] font-ui text-frh-yellow underline hover:text-frh-orange transition-colors">
                      Draft ({game.draft.status})
                    </Link>
                  )}
                  {!game.draft && (
                    <span className="ml-auto text-[10px] text-gray-700">Draft pending</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="border-t-2 border-brand-700 pt-4 mt-6">
          <Link href="/schedule">
            <BrutalButton variant="secondary" size="sm">&#8592; Back to Schedule</BrutalButton>
          </Link>
        </div>
      </RetroWindow>
    </div>
  );
}
