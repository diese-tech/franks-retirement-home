'use client';

import Link from 'next/link';
import { BrutalButton, StatusBadge } from '@/components/ui';

// Sub-components

export function FrhSectionLabel({ kind = 'default', pill, title, after }) {
  return (
    <div className={`frh-section-label frh-section-label--${kind}`}>
      <span className="frh-section-label__pill">{pill}</span>
      <span className="frh-section-label__title">{title}</span>
      {after && <span className="frh-section-label__after">{after}</span>}
    </div>
  );
}

export function FrhPanel({ title, accent = 'yellow', kicker, status, children }) {
  return (
    <section className="frh-panel">
      <header className={`frh-panel__titlebar frh-panel__titlebar--${accent}`}>
        <div className="frh-panel__ttl">
          <span className="frh-panel__accent" />
          {title}
          {kicker && (
            <span style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.85, letterSpacing: '0.1em' }}>
              {kicker}
            </span>
          )}
        </div>
        <div className="frh-panel__chips">
          <span className="frh-panel__chip">_</span>
          <span className="frh-panel__chip">&#9633;</span>
          <span className="frh-panel__chip">&times;</span>
        </div>
      </header>
      <div className="frh-panel__body">{children}</div>
      {status && (
        <div className="frh-panel__statusbar">
          {Array.isArray(status)
            ? status.map((s, i) => <span key={i}>{s}</span>)
            : <span>{status}</span>}
        </div>
      )}
    </section>
  );
}

export function FrhMasthead({ activeSeason, playerCount, matchCount, godCount }) {
  const seasonNum = activeSeason?.name?.match(/\d+/)?.[0] ?? '?';
  return (
    <header className="frh-masthead">
      <h1 className="frh-masthead__logo">
        <span className="frh">FRH</span>BROADCAST
        <span className="sub">Frank&apos;s Retirement Home &middot; Smite 2 Beer-League Portal</span>
      </h1>
      <div className="frh-masthead__meta">
        <div className="frh-statchip">
          <div className="frh-statchip__num">{seasonNum}</div>
          <div className="frh-statchip__lbl">Season</div>
        </div>
        <div className="frh-statchip">
          <div className="frh-statchip__num">{playerCount ?? 0}</div>
          <div className="frh-statchip__lbl">Players</div>
        </div>
        <div className="frh-statchip">
          <div className="frh-statchip__num">{matchCount ?? 0}</div>
          <div className="frh-statchip__lbl">Matches</div>
        </div>
        <div className="frh-statchip">
          <div className="frh-statchip__num">{godCount ?? 0}</div>
          <div className="frh-statchip__lbl">Gods</div>
        </div>
      </div>
    </header>
  );
}

export function FrhMegaScoreboard({ liveMatch, upcomingMatch }) {
  if (liveMatch) {
    const m = liveMatch;
    const homeColor = m.homeTeam?.accentColor ?? '#CC3300';
    const awayColor = m.awayTeam?.accentColor ?? '#2B5BA8';
    const homeScore = m.games?.filter(g => g.winnerId === m.homeTeamId).length ?? 0;
    const awayScore = m.games?.filter(g => g.winnerId === m.awayTeamId).length ?? 0;
    return (
      <div className="frh-mega">
        <div className="frh-mega__topbar">
          <span className="live-dot" />
          ON AIR &middot; LIVE MATCH
          <span style={{ opacity: 0.85 }}>&nbsp;&middot; {m.division?.name ?? 'FRH Pro Division'}</span>
          <span className="right">FRH BROADCAST</span>
        </div>
        <div className="frh-mega__teams">
          <div className="frh-mega__side" style={{ background: homeColor }}>
            <div className="frh-mega__crest">{m.homeTeam?.tag ?? '?'}</div>
            <div>
              <div className="frh-mega__teamname">{m.homeTeam?.name ?? 'Home Team'}</div>
              <div className="frh-mega__record">HOME</div>
            </div>
          </div>
          <div className="frh-mega__center">
            <div className="frh-mega__period">BO3 SERIES</div>
            <div className="frh-mega__scores">
              <span>{homeScore}</span>
              <span className="sep">&ndash;</span>
              <span>{awayScore}</span>
            </div>
            <div className="frh-mega__clock">LIVE</div>
            <div className="frh-mega__period">GAME SCORE</div>
          </div>
          <div className="frh-mega__side right" style={{ background: awayColor }}>
            <div className="frh-mega__crest">{m.awayTeam?.tag ?? '?'}</div>
            <div>
              <div className="frh-mega__teamname">{m.awayTeam?.name ?? 'Away Team'}</div>
              <div className="frh-mega__record">AWAY</div>
            </div>
          </div>
        </div>
        <div className="frh-mega__winprob">
          <div className="home" style={{ flex: 60, background: homeColor }}>
            {m.homeTeam?.tag} &middot; WIN PROB 60%
          </div>
          <div className="away" style={{ flex: 40, background: awayColor }}>
            40% &middot; {m.awayTeam?.tag}
          </div>
        </div>
        <div className="frh-mega__lowerthird">
          <span><b>LIVE:</b> {m.homeTeam?.name} vs {m.awayTeam?.name}</span>
          <span><b>DIV:</b> {m.division?.name}</span>
          <span style={{ marginLeft: 'auto' }}><b>FRH</b> twitch.tv/frh-broadcast</span>
        </div>
      </div>
    );
  }

  if (upcomingMatch) {
    const m = upcomingMatch;
    const homeColor = m.homeTeam?.accentColor ?? '#CC3300';
    const awayColor = m.awayTeam?.accentColor ?? '#2B5BA8';
    const dt = m.scheduledAt ? new Date(m.scheduledAt) : null;
    const dateStr = dt ? dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'TBD';
    const timeStr = dt ? dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
    return (
      <div className="frh-mega">
        <div className="frh-mega__topbar frh-mega__topbar--upcoming">
          UPCOMING &middot; {m.division?.name ?? 'FRH Pro Division'}
          <span className="right">{dateStr}{timeStr ? ` \u00b7 ${timeStr}` : ''}</span>
        </div>
        <div className="frh-mega__teams">
          <div className="frh-mega__side" style={{ background: homeColor }}>
            <div className="frh-mega__crest">{m.homeTeam?.tag ?? '?'}</div>
            <div>
              <div className="frh-mega__teamname">{m.homeTeam?.name ?? 'Home Team'}</div>
              <div className="frh-mega__record">HOME</div>
            </div>
          </div>
          <div className="frh-mega__center">
            <div className="frh-mega__period">NEXT UP</div>
            <div className="frh-mega__scores" style={{ fontSize: 48, letterSpacing: 4 }}>
              <span style={{ opacity: 0.3 }}>&mdash;</span>
              <span className="sep" style={{ fontSize: 28 }}>vs</span>
              <span style={{ opacity: 0.3 }}>&mdash;</span>
            </div>
            <div className="frh-mega__clock" style={{ fontSize: 20 }}>{dateStr}</div>
            <div className="frh-mega__period">{timeStr}</div>
          </div>
          <div className="frh-mega__side right" style={{ background: awayColor }}>
            <div className="frh-mega__crest">{m.awayTeam?.tag ?? '?'}</div>
            <div>
              <div className="frh-mega__teamname">{m.awayTeam?.name ?? 'Away Team'}</div>
              <div className="frh-mega__record">AWAY</div>
            </div>
          </div>
        </div>
        <div className="frh-mega__lowerthird">
          <span><b>NEXT:</b> {m.homeTeam?.name} vs {m.awayTeam?.name}</span>
          <span><b>DIV:</b> {m.division?.name}</span>
          <Link href="/schedule" style={{ marginLeft: 'auto', color: '#ffd400' }}>Full schedule &rarr;</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="frh-mega">
      <div className="frh-mega__topbar" style={{ background: '#1240b8' }}>
        NO SIGNAL &middot; FRH BROADCAST
        <span className="right">CH 09</span>
      </div>
      <div style={{ background: '#1240b8', padding: '32px 24px', color: '#fff', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
        <div style={{ fontSize: 56, marginBottom: 16, fontFamily: 'inherit' }}>:(</div>
        <p style={{ margin: '0 0 10px' }}><b>FRH_BROADCAST</b> has encountered a <b>washed event</b> and needs to close.</p>
        <p style={{ margin: '0 0 6px', opacity: 0.7 }}>No live matches. Everyone is probably arguing in Discord.</p>
        <p style={{ margin: '0', opacity: 0.5, fontSize: 11 }}>*** STOP: 0xWASHED_OUT_DEEP (0x00000005, 0xFEEDC0DE)</p>
      </div>
      <div className="frh-mega__lowerthird">
        <span><b>STATUS:</b> Off-season / no matches scheduled</span>
        <Link href="/schedule" style={{ marginLeft: 'auto', color: '#ffd400' }}>Check schedule &rarr;</Link>
      </div>
    </div>
  );
}

export function FrhCrtPanel({ isLive, liveMatch }) {
  return (
    <div className={`frh-crt${isLive ? '' : ' frh-crt--offline'}`}>
      <div className="frh-crt__bezel">
        {isLive && liveMatch ? (
          <div className="frh-live-feed">
            <div className="frh-live-feed__hero">
              &ldquo;{liveMatch.homeTeam?.name ?? 'HOME'}<br />vs<br />{liveMatch.awayTeam?.name ?? 'AWAY'}&rdquo;
            </div>
            <div className="frh-live-feed__lower">
              <div><span>NOW BROADCASTING</span>FRH Match Night</div>
              <div style={{ textAlign: 'right' }}><span>STATUS</span>&#9679; LIVE</div>
            </div>
          </div>
        ) : (
          <div className="frh-bsod">
            <div className="face">:(</div>
            <p>FRH&nbsp;BROADCAST has encountered an unhandled <b>washed event</b> and needs to close.</p>
            <p>If this is the first time you&apos;ve seen this stop, restart your{' '}
              <span className="code">controller</span>, your{' '}
              <span className="code">marriage</span>, and your{' '}
              <span className="code">browser</span>.</p>
            <p>Technical information:</p>
            <p>*** STOP: 0xWASHED_OUT_DEEP (0x00000005, 0xFEEDC0DE)</p>
            <p className="frh-bsod__blink">Press any key to continue beefing</p>
          </div>
        )}
      </div>
      <div className="frh-crt__feet">
        <span><span className="frh-crt__powerled" />PWR</span>
        <span>FRH-CRT 2600 &middot; 4:3 &middot; 56Hz</span>
        <span>CH 09</span>
      </div>
    </div>
  );
}

function FrhDiscordCta() {
  return (
    <div className="frh-discord-cta">
      <div className="frh-discord-cta__label">COMMUNITY HQ</div>
      <div className="frh-discord-cta__title">THE LEAGUE LIVES IN DISCORD</div>
      <div className="frh-discord-cta__sub">
        Draft news &middot; Fraud alerts &middot; Hot takes &middot; Match night watch parties &middot; Admin rulings
      </div>
      <a href="https://discord.gg/HPAZmHmBpD" target="_blank" rel="noreferrer"
        className="frh-btn frh-btn--primary"
        style={{ display: 'inline-block', marginTop: 12 }}>
        &rarr; JOIN THE DISCORD
      </a>
    </div>
  );
}

// Main export

export default function HomepageClient({
  activeSeason,
  liveMatches,
  upcomingMatches,
  recentDrafts,
  divisionStandings,
  playerCount,
  godCount,
  matchCount,
  recentResults,
}) {
  const hasLive = liveMatches?.length > 0;
  const liveMatch = liveMatches?.[0] ?? null;
  const nextMatch = upcomingMatches?.[0] ?? null;
  const hasDrafts = recentDrafts?.length > 0;

  // Compute power rankings from real standings data
  const rankingsRows = (() => {
    if (divisionStandings?.length > 0) {
      const allRows = divisionStandings.flatMap(({ rows }) => rows);
      if (allRows.length >= 1) {
        return allRows.slice(0, 10).map((row, i) => ({
          rank: i + 1,
          team: row.teamName,
          tag: row.teamTag,
          trend: 0,
          blurb: 'Season record speaks for itself.',
          record: `${row.wins}\u2013${row.losses}`,
          color: '#444',
        }));
      }
    }
    return null;
  })();

  return (
    <>
      <FrhMasthead
        activeSeason={activeSeason}
        playerCount={playerCount}
        matchCount={matchCount}
        godCount={godCount}
      />

      <div className="frh-editorial-shell">

        {/* Broadcast Hero */}
        <FrhSectionLabel
          kind={hasLive ? 'live' : 'prime'}
          pill={hasLive ? 'LIVE' : 'NEXT UP'}
          title={hasLive ? 'ON AIR NOW' : 'UPCOMING MATCHUP'}
          after={
            hasLive
              ? `${liveMatch?.homeTeam?.tag ?? '?'} vs ${liveMatch?.awayTeam?.tag ?? '?'}`
              : nextMatch
              ? `${nextMatch?.homeTeam?.tag ?? '?'} vs ${nextMatch?.awayTeam?.tag ?? '?'}`
              : undefined
          }
        />
        <div className="frh-broadcast-hero">
          <FrhMegaScoreboard liveMatch={liveMatch} upcomingMatch={nextMatch} />
          <FrhCrtPanel isLive={hasLive} liveMatch={liveMatch} />
        </div>

        {/* Captain login CTA */}
        <div className="frh-captain-cta">
          <div className="frh-captain-cta__inner">
            <span className="frh-captain-cta__label">CAPTAINS</span>
            <span className="frh-captain-cta__text">Log in with Discord to access your match dashboard</span>
            <Link href="/api/auth/discord?returnUrl=/captain">
              <BrutalButton size="sm" variant="primary">Captain Login</BrutalButton>
            </Link>
          </div>
        </div>

        {/* Active draft interrupt */}
        {hasDrafts && (
          <>
            <FrhSectionLabel kind="live" pill="DRAFT" title="ACTIVE DRAFT SESSIONS" />
            <FrhPanel title="DRAFT ROOMS OPEN" accent="lime" status={['Real-time \u00b7 join before picks lock']}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {recentDrafts.map((d) => (
                  <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--frh-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <StatusBadge status={d.status} />
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: 13 }}>{d.name}</span>
                    </div>
                    <Link href={`/draft/${d.id}`}>
                      <BrutalButton size="sm" variant="primary">Watch</BrutalButton>
                    </Link>
                  </div>
                ))}
              </div>
            </FrhPanel>
          </>
        )}

        {/* Recent Results */}
        {recentResults?.length > 0 && (
          <>
            <FrhSectionLabel kind="default" pill="RESULTS" title="RECENT RESULTS" />
            <FrhPanel title="RECENT RESULTS" accent="purple">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {recentResults.slice(0, 5).map((m) => {
                  const homeWins = m.games?.filter(g => g.winnerTeamId === m.homeTeamId).length ?? 0;
                  const awayWins = m.games?.filter(g => g.winnerTeamId === m.awayTeamId).length ?? 0;
                  return (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '1px solid var(--frh-border)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                      <span style={{ flex: 1, fontWeight: 700 }}>{m.homeTeam?.name ?? 'Home'}</span>
                      <span style={{ fontWeight: 700, color: '#ffd400', minWidth: 36, textAlign: 'center' }}>{homeWins} - {awayWins}</span>
                      <span style={{ flex: 1, fontWeight: 700, textAlign: 'right' }}>{m.awayTeam?.name ?? 'Away'}</span>
                      <span style={{ marginLeft: 12, fontSize: 10, color: 'var(--frh-text-muted)', whiteSpace: 'nowrap' }}>{m.division?.name ?? ''}</span>
                    </div>
                  );
                })}
              </div>
            </FrhPanel>
          </>
        )}

        {/* Power Rankings */}
        <FrhSectionLabel kind="alert" pill="RANKINGS" title="POWER RANKINGS" />
        {rankingsRows ? (
          <FrhPanel title="POWER RANKINGS" accent="orange"
            status={['Based on current standings']}>
            {rankingsRows.map((r) => (
              <div key={r.rank} className="frh-rank">
                <div className="frh-rank__num">{r.rank}</div>
                <div className="frh-rank__crest" style={{ background: r.color }}>{r.tag}</div>
                <div className="frh-rank__name">
                  <strong>{r.team}</strong>
                  <span>{r.blurb}</span>
                </div>
                <div className="frh-rank__rec">{r.record}</div>
                <div className={`frh-rank__trend frh-rank__trend--${r.trend > 0 ? 'up' : r.trend < 0 ? 'down' : 'flat'}`}>
                  {r.trend > 0 ? `\u25b2${r.trend}` : r.trend < 0 ? `\u25bc${Math.abs(r.trend)}` : '\u2014'}
                </div>
              </div>
            ))}
          </FrhPanel>
        ) : (
          <FrhPanel title="POWER RANKINGS" accent="orange"
            status={['No standings available yet']}>
            <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, opacity: 0.6 }}>
              No standings available yet. Rankings appear after matches are played.
            </div>
          </FrhPanel>
        )}

        {/* Form Check: Hot/Cold Teams */}
        {(() => {
          const allTeams = divisionStandings?.flatMap(({ rows }) => rows) ?? [];
          if (allTeams.length < 2) return null;
          const sorted = [...allTeams].sort((a, b) => b.wins - a.wins);
          const hotTeams = sorted.slice(0, 3);
          const hotTeamIds = new Set(hotTeams.map(t => t.teamId));
          const coldTeams = [...allTeams]
            .filter(t => !hotTeamIds.has(t.teamId))
            .sort((a, b) => b.losses - a.losses)
            .slice(0, 3);
          return (
            <>
              <FrhSectionLabel kind="default" pill="FORM" title="FORM CHECK" after="HOT & COLD" />
              <FrhPanel title="FORM CHECK" accent="lime">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: '8px 12px' }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#4ade80', letterSpacing: '0.1em', marginBottom: 6 }}>HOT</div>
                    {hotTeams.map((t, i) => (
                      <div key={t.teamId ?? i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                        <span style={{ color: '#4ade80', fontWeight: 700, width: 14 }}>{i + 1}</span>
                        <span style={{ flex: 1 }}>{t.teamName}</span>
                        <span style={{ color: '#4ade80' }}>{t.wins}W</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#f87171', letterSpacing: '0.1em', marginBottom: 6 }}>COLD</div>
                    {coldTeams.map((t, i) => (
                      <div key={t.teamId ?? i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                        <span style={{ color: '#f87171', fontWeight: 700, width: 14 }}>{i + 1}</span>
                        <span style={{ flex: 1 }}>{t.teamName}</span>
                        <span style={{ color: '#f87171' }}>{t.losses}L</span>
                      </div>
                    ))}
                  </div>
                </div>
              </FrhPanel>
            </>
          );
        })()}

        {/* Upcoming Schedule + Standings */}
        <FrhSectionLabel kind="default" pill="SCHEDULE" title="THIS WEEK&apos;S SLATE + STANDINGS" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 4 }}>
          <FrhPanel title="THIS WEEK'S SLATE" accent="blue" status={['Full schedule at /schedule']}>
            {upcomingMatches?.length > 0 ? (
              <div className="frh-slate">
                {upcomingMatches.map((m) => {
                  const dt = m.scheduledAt ? new Date(m.scheduledAt) : null;
                  return (
                    <div key={m.id} className="frh-slate__row">
                      <div className="frh-slate__when">
                        {dt ? dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'TBD'}
                        {dt && <span>{dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>}
                      </div>
                      <div className="frh-slate__team">
                        <div className="frh-slate__mini-crest" style={{ background: m.homeTeam?.accentColor ?? '#444' }}>{m.homeTeam?.tag ?? '?'}</div>
                        {m.homeTeam?.name ?? 'TBD'}
                      </div>
                      <div className="frh-slate__vs">vs</div>
                      <div className="frh-slate__team right">
                        {m.awayTeam?.name ?? 'TBD'}
                        <div className="frh-slate__mini-crest" style={{ background: m.awayTeam?.accentColor ?? '#444' }}>{m.awayTeam?.tag ?? '?'}</div>
                      </div>
                      <Link href={`/matches/${m.id}`} className="frh-slate__cta">&rarr;</Link>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, opacity: 0.6 }}>
                Nobody scheduled anything. Classic.
              </div>
            )}
            <div style={{ padding: '8px 12px', borderTop: '1px solid var(--frh-border)' }}>
              <Link href="/schedule" style={{ fontSize: 11, color: '#1f6fff', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Full schedule &rarr;
              </Link>
            </div>
          </FrhPanel>

          {divisionStandings?.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {divisionStandings.map(({ division, rows }) => (
                <FrhPanel key={division.id} title={`${division.name.toUpperCase()} STANDINGS`} accent="yellow"
                  status={[`Top ${Math.min(rows.length, 5)} shown`]}>
                  {rows.length === 0 ? (
                    <div style={{ padding: '16px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, opacity: 0.6 }}>No completed matches yet.</div>
                  ) : (
                    rows.slice(0, 5).map((row, i) => (
                      <div key={row.teamId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', borderBottom: '1px solid var(--frh-border)', background: i === 0 ? 'rgba(255,212,0,0.06)' : undefined }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, width: 18, color: i === 0 ? '#CC3300' : 'var(--frh-text-muted)' }}>{i + 1}</span>
                        <Link href={`/teams/${row.teamId}`} style={{ flex: 1, minWidth: 0, textDecoration: 'none' }}>
                          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, color: 'var(--frh-text)' }}>{row.teamName}</span>
                          <span style={{ marginLeft: 6, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--frh-text-muted)' }}>[{row.teamTag}]</span>
                        </Link>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                          <span style={{ color: '#4ade80', fontWeight: 700 }}>{row.wins}</span>
                          <span style={{ color: 'var(--frh-text-muted)' }}>&ndash;</span>
                          <span style={{ color: '#f87171', fontWeight: 700 }}>{row.losses}</span>
                        </span>
                      </div>
                    ))
                  )}
                  <div style={{ padding: '8px 12px' }}>
                    <Link href="/standings" style={{ fontSize: 11, color: '#ffd400', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', textDecoration: 'none' }}>
                      Full standings &rarr;
                    </Link>
                  </div>
                </FrhPanel>
              ))}
            </div>
          ) : (
            <FrhPanel title="STANDINGS" accent="yellow" status={['Season pending']}>
              <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, opacity: 0.6 }}>
                Standings update after Week 1 results are approved.
              </div>
            </FrhPanel>
          )}
        </div>

        {/* Discord CTA */}
        <FrhDiscordCta />
      </div>
    </>
  );
}

