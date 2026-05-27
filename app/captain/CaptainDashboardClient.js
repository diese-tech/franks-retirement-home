'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { RetroWindow, BrutalButton, PixelBadge } from '@/components/ui';

function MatchCard({ match }) {
  const opponent = match.captainSide === 'home' ? match.awayTeam : match.homeTeam;
  const scheduledAt = match.scheduledAt ? new Date(match.scheduledAt) : null;

  // Compute series score
  const homeWins = match.games?.filter((g) => g.winnerTeamId === match.homeTeamId).length ?? 0;
  const awayWins = match.games?.filter((g) => g.winnerTeamId === match.awayTeamId).length ?? 0;

  // Find actionable states
  const draftInProgress = match.games?.find(
    (g) => g.draft && ['lobby', 'banning', 'picking'].includes(g.draft.status)
  );
  const gameAwaitingReport = match.games?.find(
    (g) => g.draft?.status === 'complete' && !g.resultStatus
  );
  const gameAwaitingConfirmation = match.games?.find(
    (g) => g.resultStatus === 'reported'
  );
  const hasPendingReschedule = match.rescheduleStatus === 'pending';

  return (
    <div className="border-2 border-frh-border bg-frh-base/40 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="font-ui text-sm text-frh-text">
            vs {opponent?.name ?? 'TBD'}
          </span>
          <PixelBadge label={match.format ?? 'BO3'} color="purple" />
          {match.week && (
            <span className="font-mono text-[10px] text-frh-text-muted">Week {match.week}</span>
          )}
        </div>
        {(match.status === 'live' || match.status === 'completed') && (
          <span className="font-mono text-xs text-frh-yellow">
            {homeWins} - {awayWins}
          </span>
        )}
      </div>

      {scheduledAt && (
        <p className="font-mono text-[10px] text-frh-text-muted">
          {scheduledAt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
          {' '}
          {scheduledAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
        </p>
      )}

      <div className="flex gap-2 flex-wrap">
        {draftInProgress && (
          <Link href={`/draft/${draftInProgress.draft.id}`}>
            <BrutalButton size="sm" variant="primary">Enter Draft</BrutalButton>
          </Link>
        )}
        {gameAwaitingReport && !draftInProgress && (
          <Link href={`/matches/${match.id}`}>
            <BrutalButton size="sm" variant="primary">Report Result</BrutalButton>
          </Link>
        )}
        {gameAwaitingConfirmation && !draftInProgress && !gameAwaitingReport && (
          <Link href={`/matches/${match.id}`}>
            <BrutalButton size="sm" variant="secondary">Confirm Result</BrutalButton>
          </Link>
        )}
        {match.status === 'completed' && (
          <Link href={`/matches/${match.id}`}>
            <BrutalButton size="sm" variant="secondary">Upload Screenshots</BrutalButton>
          </Link>
        )}
        {(hasPendingReschedule || match.status === 'scheduled') && (
          <Link href={`/matches/${match.id}`}>
            <BrutalButton size="sm" variant="secondary">
              {hasPendingReschedule ? 'Reschedule' : 'View Match'}
            </BrutalButton>
          </Link>
        )}
      </div>
    </div>
  );
}

export default function CaptainDashboardClient() {
  const [authState, setAuthState] = useState(null); // null=loading
  const [matches, setMatches] = useState([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [matchesError, setMatchesError] = useState('');

  useEffect(() => {
    fetch('/api/auth/discord/me')
      .then((res) => {
        if (res.status === 401) return { anonymous: true };
        if (!res.ok) return { anonymous: true };
        return res.json();
      })
      .then(setAuthState)
      .catch(() => setAuthState({ anonymous: true }));
  }, []);

  useEffect(() => {
    if (!authState || authState.anonymous || !authState.teamId) return;
    setMatchesLoading(true);
    fetch('/api/captain/matches')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load matches');
        return res.json();
      })
      .then(setMatches)
      .catch((err) => setMatchesError(err.message))
      .finally(() => setMatchesLoading(false));
  }, [authState]);

  // Loading state
  if (authState === null) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <RetroWindow title="CAPTAIN DASHBOARD">
          <p className="font-mono text-xs text-frh-text-muted">Loading...</p>
        </RetroWindow>
      </div>
    );
  }

  // Not authenticated - show login prompt
  if (authState.anonymous) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <RetroWindow title="CAPTAIN LOGIN" titleBarColor="yellow">
          <div className="text-center space-y-4 py-4">
            <p className="font-mono text-sm text-frh-text">
              Captains log in with Discord to access their match dashboard.
            </p>
            <p className="font-mono text-[10px] text-frh-text-muted">
              Your Discord roles determine which team you captain.
            </p>
            <Link href="/api/auth/discord?returnUrl=/captain">
              <BrutalButton size="md" variant="primary">Log in with Discord</BrutalButton>
            </Link>
          </div>
        </RetroWindow>
      </div>
    );
  }

  // Authenticated but no team
  if (!authState.teamId) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <RetroWindow title="CAPTAIN DASHBOARD" titleBarColor="orange">
          <div className="text-center space-y-4 py-4">
            <p className="font-mono text-sm text-frh-text">
              Your Discord account is not linked to any FRH team.
            </p>
            <p className="font-mono text-[10px] text-frh-text-muted">
              Make sure you have the Captain role and a team role in the FRH Discord server.
            </p>
          </div>
        </RetroWindow>
      </div>
    );
  }

  // Authenticated with team - show dashboard
  const liveMatches = matches.filter((m) => m.status === 'live');
  const upcomingMatches = matches.filter((m) => m.status === 'scheduled');
  const recentMatches = matches.filter((m) => m.status === 'completed');

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <RetroWindow title="CAPTAIN DASHBOARD" titleBarColor="yellow">
        {/* Header */}
        <div className="mb-6 border-b-2 border-frh-border pb-4">
          <p className="font-ui text-xs uppercase tracking-widest text-frh-text-muted">
            Captain: {authState.username}
          </p>
        </div>

        {matchesLoading && (
          <p className="font-mono text-xs text-frh-text-muted">Loading matches...</p>
        )}
        {matchesError && (
          <p className="font-mono text-xs text-red-400">{matchesError}</p>
        )}

        {!matchesLoading && !matchesError && (
          <div className="space-y-6">
            {/* LIVE MATCHES */}
            <div>
              <h3 className="font-ui text-xs uppercase tracking-widest text-frh-lime mb-2">
                Live Matches
              </h3>
              {liveMatches.length === 0 ? (
                <p className="font-mono text-[10px] text-frh-text-muted">No live matches right now</p>
              ) : (
                <div className="space-y-2">
                  {liveMatches.map((m) => <MatchCard key={m.id} match={m} />)}
                </div>
              )}
            </div>

            {/* UPCOMING */}
            <div>
              <h3 className="font-ui text-xs uppercase tracking-widest text-frh-yellow mb-2">
                Upcoming
              </h3>
              {upcomingMatches.length === 0 ? (
                <p className="font-mono text-[10px] text-frh-text-muted">No upcoming matches scheduled</p>
              ) : (
                <div className="space-y-2">
                  {upcomingMatches.map((m) => <MatchCard key={m.id} match={m} />)}
                </div>
              )}
            </div>

            {/* RECENT */}
            <div>
              <h3 className="font-ui text-xs uppercase tracking-widest text-frh-text-muted mb-2">
                Recent
              </h3>
              {recentMatches.length === 0 ? (
                <p className="font-mono text-[10px] text-frh-text-muted">No recent matches</p>
              ) : (
                <div className="space-y-2">
                  {recentMatches.map((m) => <MatchCard key={m.id} match={m} />)}
                </div>
              )}
            </div>
          </div>
        )}
      </RetroWindow>
    </div>
  );
}
