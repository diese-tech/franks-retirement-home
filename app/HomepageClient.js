'use client';

import Link from 'next/link';
import { RetroWindow, BrutalButton, StatusBadge } from '@/components/ui';
import RightRailWidget from '@/components/ui/RightRailWidget';

export default function HomepageClient({
  activeSeason,
  liveMatches,
  upcomingMatches,
  recentDrafts,
  divisionStandings,
  playerCount,
  godCount,
}) {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Hero */}
      <div className="border-b-[3px] border-frh-yellow pb-6 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl sm:text-5xl font-bold uppercase text-frh-yellow leading-tight">
              Frank&apos;s Retirement Home
            </h1>
            <p className="mt-1 text-sm font-body text-frh-cream">
              {activeSeason
                ? `${activeSeason.name} · Low skill. High commitment.`
                : 'Low skill. High commitment. Questionable picks.'}
            </p>
          </div>
          <div className="flex gap-3 shrink-0">
            <StatBox number={playerCount} label="Players" />
            <StatBox number={godCount} label="Gods" />
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main column */}
        <div className="flex-1 min-w-0 space-y-5">

          {/* Live matches */}
          {liveMatches.length > 0 && (
            <RetroWindow title="LIVE NOW" titleBarColor="lime">
              <div className="space-y-3">
                {liveMatches.map((m) => (
                  <MatchRow key={m.id} match={m} live />
                ))}
              </div>
            </RetroWindow>
          )}

          {/* Upcoming schedule */}
          <RetroWindow title="UPCOMING MATCHES">
            {upcomingMatches.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-gray-600">No matches scheduled yet.</p>
                <Link href="/schedule" className="text-xs text-frh-yellow hover:underline mt-2 inline-block">
                  View full schedule →
                </Link>
              </div>
            ) : (
              <>
                <div className="space-y-2 mb-3">
                  {upcomingMatches.map((m) => (
                    <MatchRow key={m.id} match={m} />
                  ))}
                </div>
                <Link href="/schedule" className="text-xs text-frh-yellow hover:underline font-ui uppercase tracking-wide">
                  Full schedule →
                </Link>
              </>
            )}
          </RetroWindow>

          {/* Standings preview */}
          {divisionStandings.length > 0 && (
            <div className="space-y-4">
              {divisionStandings.map(({ division, rows }) => (
                <RetroWindow key={division.id} title={`${division.name.toUpperCase()} STANDINGS`}>
                  {rows.length === 0 ? (
                    <p className="text-sm text-gray-600 text-center py-4">No completed matches yet.</p>
                  ) : (
                    <>
                      <div className="space-y-0">
                        {rows.map((row, i) => (
                          <div
                            key={row.teamId}
                            className={`flex items-center gap-3 py-2 border-b border-brand-700/40 last:border-0 ${i === 0 ? 'bg-frh-yellow/5' : ''}`}
                          >
                            <span className={`font-ui text-xs w-5 text-center ${i === 0 ? 'text-frh-yellow font-bold' : 'text-gray-600'}`}>{i + 1}</span>
                            <Link href={`/teams/${row.teamId}`} className="flex-1 min-w-0 hover:text-frh-yellow transition-colors">
                              <span className="font-display font-bold text-sm text-gray-200">{row.teamName}</span>
                              <span className="ml-2 font-mono text-[10px] text-gray-600">[{row.teamTag}]</span>
                            </Link>
                            <span className="font-mono text-xs shrink-0">
                              <span className="text-green-400 font-bold">{row.wins}</span>
                              <span className="text-gray-600">–</span>
                              <span className="text-red-400 font-bold">{row.losses}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                      <Link href="/standings" className="block text-xs text-frh-yellow hover:underline font-ui uppercase tracking-wide mt-3">
                        Full standings →
                      </Link>
                    </>
                  )}
                </RetroWindow>
              ))}
            </div>
          )}

          {/* Active god drafts */}
          {recentDrafts.length > 0 && (
            <RetroWindow title="ACTIVE DRAFT SESSIONS">
              <div className="space-y-2">
                {recentDrafts.map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-3 py-2 border-b border-brand-700/40 last:border-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <StatusBadge status={d.status} />
                      <span className="font-body text-sm text-gray-300 truncate">{d.name}</span>
                    </div>
                    <BrutalButton href={`/draft/${d.id}`} size="sm" variant="secondary">Watch</BrutalButton>
                  </div>
                ))}
              </div>
            </RetroWindow>
          )}

        </div>

        {/* Right rail */}
        <div className="hidden lg:flex flex-col gap-4 w-56 shrink-0">
          <RightRailWidget title="NAVIGATE">
            <nav className="space-y-2">
              {[
                { href: '/schedule', label: 'Schedule' },
                { href: '/standings', label: 'Standings' },
                { href: '/teams', label: 'Teams' },
                { href: '/players', label: 'Players' },
              ].map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="block text-frh-xp-blue hover:text-frh-yellow text-xs font-ui uppercase tracking-wide transition-colors"
                >
                  → {label}
                </Link>
              ))}
            </nav>
          </RightRailWidget>

          <RightRailWidget title="WHAT IS FRH?">
            <p className="text-xs font-body text-frh-cream leading-relaxed">
              Beer-league Smite 2 draft league. Nobody knows the meta. That&apos;s the point.
            </p>
            <a
              href="https://discord.gg/HPAZmHmBpD"
              target="_blank"
              rel="noreferrer"
              className="block text-frh-xp-blue hover:text-frh-yellow text-xs font-ui uppercase tracking-wide transition-colors mt-2"
            >
              → Join Discord
            </a>
          </RightRailWidget>

          {activeSeason && (
            <RightRailWidget title="SEASON INFO">
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-[10px] font-ui uppercase text-gray-600">Season</span>
                  <span className="font-mono text-xs text-frh-yellow">{activeSeason.name}</span>
                </div>
                {activeSeason.divisions.map((d) => (
                  <div key={d.id} className="flex justify-between">
                    <span className="text-[10px] font-ui uppercase text-gray-600">{d.name}</span>
                  </div>
                ))}
              </div>
            </RightRailWidget>
          )}
        </div>
      </div>
    </div>
  );
}

function StatBox({ number, label }) {
  return (
    <div className="border-2 border-gray-700 bg-brand-800 px-4 py-3 text-center shadow-[4px_4px_0px_rgba(0,0,0,0.5)]">
      <div className="font-mono text-2xl font-bold text-frh-yellow">{number}</div>
      <div className="text-[10px] font-ui uppercase tracking-widest text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}

function MatchRow({ match, live = false }) {
  return (
    <div className={`flex items-center gap-3 py-2 px-2 ${live ? 'border border-green-500/30 bg-green-500/5' : 'border-b border-brand-700/40 last:border-0'}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-display font-bold text-sm text-gray-200">
            {match.homeTeam?.tag} <span className="text-gray-600 font-normal text-xs">vs</span> {match.awayTeam?.tag}
          </span>
          {live && <span className="text-[9px] font-ui uppercase text-green-400 border border-green-500/50 px-1 animate-pulse">Live</span>}
          <span className="text-[10px] text-gray-600">{match.division?.name}</span>
        </div>
        {match.scheduledAt && !live && (
          <span className="text-[10px] text-gray-600 font-mono">
            {new Date(match.scheduledAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            {' '}
            {new Date(match.scheduledAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </span>
        )}
      </div>
      <Link href={`/matches/${match.id}`}>
        <BrutalButton size="sm" variant={live ? 'primary' : 'secondary'}>
          {live ? 'Watch' : 'Details'}
        </BrutalButton>
      </Link>
    </div>
  );
}
