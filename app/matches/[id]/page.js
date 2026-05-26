import prisma from '@/lib/db';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RetroWindow, PixelBadge, BrutalButton } from '@/components/ui';
import CaptainUploadSection from './CaptainUploadSection';
import CaptainRescheduleSection from './CaptainRescheduleSection';
import CaptainResultSection from './CaptainResultSection';
import { computeScore } from '@/lib/seriesResult';

export const dynamic = 'force-dynamic';

// Returns the teamId the captain key belongs to, or null.
function verifyCaptainKey(match, key) {
  if (!key) return null;
  if (key === match.homeTeamCaptainKey) return match.homeTeamId;
  if (key === match.awayTeamCaptainKey) return match.awayTeamId;
  return null;
}

// Returns 'home' | 'away' | null — used for the reschedule + result sections.
function resolveCaptainSideFromKey(match, key) {
  if (!key) return null;
  if (key === match.homeTeamCaptainKey) return 'home';
  if (key === match.awayTeamCaptainKey) return 'away';
  return null;
}

// Resolve the correct draft URL for a captain: their match captain key maps to
// captainA (home) or captainB (away) on the draft.
function draftCaptainUrl(game, captainSide, origin) {
  if (!game.draft) return null;
  const draftKey = captainSide === 'home' ? game.draft.captainAKey : game.draft.captainBKey;
  if (!draftKey) return `${origin}/draft/${game.draft.id}`;
  return `${origin}/draft/${game.draft.id}?key=${draftKey}`;
}

// ─── Game card state label ────────────────────────────────────────────────────

function getGameCardState(game, isUnneeded) {
  if (isUnneeded) return 'unneeded';
  if (!game) return 'draft_pending';

  switch (game.resultStatus) {
    case 'confirmed': return 'confirmed';
    case 'disputed':  return 'disputed';
    case 'reported':  return 'result_reported';
  }

  if (!game.draft) return 'draft_pending';
  if (game.draft.status === 'complete') return 'draft_complete';
  if (['lobby', 'banning', 'picking'].includes(game.draft.status)) return 'draft_in_progress';
  return 'draft_pending';
}

const CARD_STATE_LABEL = {
  draft_pending:    { text: 'Draft pending',                   color: 'text-frh-text-muted' },
  draft_in_progress:{ text: 'Draft in progress',              color: 'text-frh-yellow' },
  draft_complete:   { text: 'Draft complete — awaiting result', color: 'text-blue-400' },
  result_reported:  { text: 'Result reported — awaiting confirmation', color: 'text-orange-400' },
  confirmed:        { text: 'Confirmed',                        color: 'text-frh-lime' },
  disputed:         { text: 'Disputed — admin review required', color: 'text-red-400' },
  unneeded:         { text: 'Not needed',                       color: 'text-gray-600' },
};

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
  const { id } = await params;
  const awaitedSearch = await searchParams;

  const match = await prisma.match.findUnique({
    where: { id },
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
          draft: {
            select: {
              id: true,
              status: true,
              captainAKey: true,
              captainBKey: true,
            },
          },
        },
      },
    },
  });

  if (!match) notFound();

  const captainKey = awaitedSearch?.key ?? null;
  const captainTeamId = verifyCaptainKey(match, captainKey);
  const captainSide = resolveCaptainSideFromKey(match, captainKey);
  const isLive = match.status === 'live';
  const isCompleted = match.status === 'completed';

  // ── Series score ────────────────────────────────────────────────────────────
  const { homeWins, awayWins } = computeScore(
    match.games,
    match.homeTeamId,
    match.awayTeamId,
  );

  // ── Which games are actually needed? ────────────────────────────────────────
  // In a BO3, once someone reaches 2 wins, Game 3 is unneeded.
  // In a BO5, once someone reaches 3 wins, remaining games are unneeded.
  const FORMAT_WIN_THRESHOLD = { BO1: 1, BO3: 2, BO5: 3 };
  const winThreshold = FORMAT_WIN_THRESHOLD[match.format] ?? 1;
  const seriesWon = homeWins >= winThreshold || awayWins >= winThreshold;

  // A game is unneeded if:
  //   - series is already won AND this game has no confirmed result yet
  //   - AND this game is at a number beyond what was necessary
  const confirmedGameCount = match.games.filter((g) => g.resultStatus === 'confirmed').length;

  // Origin for building absolute draft URLs
  const origin = process.env.NEXT_PUBLIC_ORIGIN ?? '';

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-4">
        <Link href="/schedule" className="text-xs font-ui text-frh-text-muted hover:text-frh-yellow transition-colors uppercase tracking-widest">
          &#8592; Schedule
        </Link>
      </div>

      <RetroWindow title="MATCH FILE" titleBarColor={isLive ? 'lime' : isCompleted ? 'purple' : 'yellow'}>
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

          {/* Stream / VOD links */}
          {match.streamUrl && (
            <div className="mt-3">
              <a href={match.streamUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 border-2 border-frh-lime text-frh-lime font-ui text-xs uppercase px-3 py-1.5 hover:bg-frh-lime/10 transition-colors">
                &#9654; Watch Live
              </a>
            </div>
          )}
          {match.vodUrl && !match.streamUrl && (
            <div className="mt-3">
              <a href={match.vodUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 border-2 border-frh-purple text-frh-purple font-ui text-xs uppercase px-3 py-1.5 hover:bg-frh-purple/10 transition-colors">
                &#9654; Watch VOD
              </a>
            </div>
          )}
        </div>

        {/* ── Live series score ─────────────────────────────────────────────── */}
        {(isLive || isCompleted || homeWins > 0 || awayWins > 0) && (
          <div className="mb-6 border-2 border-frh-border bg-frh-base/40 px-4 py-3">
            <p className="text-[10px] font-ui uppercase text-frh-text-muted mb-2">
              {isCompleted ? 'Final Score' : 'Live Score'}
            </p>
            <div className="flex items-center gap-4">
              <div className="flex-1 text-center">
                <p className="font-display font-bold text-3xl text-frh-yellow">{homeWins}</p>
                <p className="font-ui text-xs text-frh-text-muted truncate">{match.homeTeam?.name}</p>
              </div>
              <div className="font-mono text-xl text-frh-text-muted">—</div>
              <div className="flex-1 text-center">
                <p className="font-display font-bold text-3xl text-frh-yellow">{awayWins}</p>
                <p className="font-ui text-xs text-frh-text-muted truncate">{match.awayTeam?.name}</p>
              </div>
            </div>
            {isCompleted && (
              <p className="text-[10px] font-mono text-frh-lime text-center mt-2">
                {homeWins >= winThreshold ? match.homeTeam?.name : match.awayTeam?.name} wins the series
              </p>
            )}
          </div>
        )}

        {/* ── Rosters ──────────────────────────────────────────────────────── */}
        <div className="flex gap-6 mb-8 flex-wrap sm:flex-nowrap">
          <RosterColumn team={match.homeTeam} label="Home" />
          <div className="hidden sm:flex items-center text-frh-text-muted text-xl font-mono self-center">vs</div>
          <RosterColumn team={match.awayTeam} label="Away" />
        </div>

        {/* ── Games ────────────────────────────────────────────────────────── */}
        {match.games.length > 0 && (
          <div className="mb-6">
            <h2 className="font-ui text-xs uppercase tracking-widest text-frh-text-muted mb-3">Games</h2>
            <div className="space-y-2">
              {match.games.map((game, idx) => {
                // A game is unneeded if it's beyond the decisive game in a won series
                const isUnneeded = seriesWon && game.resultStatus !== 'confirmed' && idx >= confirmedGameCount;
                const cardState = getGameCardState(game, isUnneeded);
                const stateInfo = CARD_STATE_LABEL[cardState] ?? CARD_STATE_LABEL.draft_pending;

                // Build draft URL — captain gets their own keyed URL
                const draftUrl = game.draft
                  ? captainSide
                    ? draftCaptainUrl(game, captainSide, origin)
                    : `/draft/${game.draft.id}`
                  : null;

                return (
                  <div key={game.id} className={`border-2 px-3 py-2 ${isUnneeded ? 'border-brand-800 opacity-40' : 'border-frh-border'} bg-frh-base/40`}>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-ui text-xs text-frh-text-muted w-16 shrink-0">Game {game.gameNumber}</span>

                      {/* State label */}
                      <span className={`text-[10px] font-mono ${stateInfo.color}`}>
                        {stateInfo.text}
                      </span>

                      {/* Confirmed result */}
                      {game.winnerTeamId && (
                        <span className="text-xs text-frh-lime font-mono">
                          {game.winnerTeamId === match.homeTeamId ? match.homeTeam?.name : match.awayTeam?.name} won
                        </span>
                      )}

                      {/* Reported (unconfirmed) winner */}
                      {game.resultStatus === 'reported' && game.reportedWinnerTeamId && !game.winnerTeamId && (
                        <span className="text-[10px] text-orange-300 font-mono">
                          Reported: {game.reportedWinnerTeamId === match.homeTeamId ? match.homeTeam?.name : match.awayTeam?.name}
                        </span>
                      )}

                      {/* Draft link */}
                      {draftUrl && (
                        <Link
                          href={draftUrl}
                          className="ml-auto text-[10px] font-ui text-frh-yellow underline hover:text-frh-orange transition-colors shrink-0"
                        >
                          {captainSide ? 'Enter Draft Room' : `Draft (${game.draft.status})`}
                        </Link>
                      )}
                      {!game.draft && !isUnneeded && (
                        <span className="ml-auto text-[10px] text-frh-text-muted">Draft pending</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Captain result reporting ──────────────────────────────────────── */}
        {captainSide && !isCompleted && (
          <CaptainResultSection
            matchId={match.id}
            captainKey={captainKey}
            captainSide={captainSide}
            games={match.games}
            homeTeam={{ id: match.homeTeamId, name: match.homeTeam?.name }}
            awayTeam={{ id: match.awayTeamId, name: match.awayTeam?.name }}
          />
        )}

        {/* ── Post-match screenshot upload CTA (Layer 2) ───────────────────── */}
        {isCompleted ? (
          <div className="border-2 border-frh-border bg-frh-base/40 px-4 py-4 mb-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="font-ui text-xs uppercase tracking-widest text-frh-lime mb-1">Match Complete</p>
                <p className="text-sm text-frh-text-muted">
                  Upload screenshots for each game to submit stats for the leaderboard.
                  This is separate from the result — the series result is already recorded.
                </p>
              </div>
            </div>
            {captainTeamId && (
              <div className="mt-4">
                <CaptainUploadSection
                  games={match.games}
                  captainKey={captainKey}
                />
              </div>
            )}
            {!captainTeamId && (
              <p className="text-[10px] text-frh-text-muted mt-3 font-mono">
                Captains: visit this page with your captain link to upload screenshots.
              </p>
            )}
          </div>
        ) : (
          captainTeamId && (
            <CaptainUploadSection
              games={match.games}
              captainKey={captainKey}
            />
          )
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
