'use client';

import { useState } from 'react';
import Link from 'next/link';

const ROLE_ORDER = ['Solo', 'Jungle', 'Mid', 'Support', 'Carry', 'Fill'];

function roleSort(a, b) {
  const ai = ROLE_ORDER.indexOf(a.role);
  const bi = ROLE_ORDER.indexOf(b.role);
  return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
}

function TeamCard({ team }) {
  const accentColor = team.org?.accentColor ?? '#1040aa';
  const initials = team.org?.logoInitials ?? team.tag?.slice(0, 2) ?? '??';
  const members = [...(team.members ?? [])].sort((a, b) => roleSort(a, b));

  return (
    <div className="team-card">
      <div className="team-card__band" style={{ background: accentColor }} />
      <div className="team-card__head">
        <div className="team-card__crest" style={{ background: accentColor + '22' }}>
          {initials}
        </div>
        <div className="team-card__name">{team.name}</div>
        <div className="team-card__tag">{team.tag}</div>
      </div>
      <div className="team-card__body">
        {members.length === 0 ? (
          <div style={{ padding: '12px', fontFamily: 'Share Tech Mono, monospace', fontSize: 10, opacity: 0.5, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            No roster data
          </div>
        ) : (
          members.map(m => (
            <div key={m.id} className="team-card__row">
              <span className="team-card__role">{m.role ?? m.player?.role}</span>
              <span className="team-card__player-name">
                {m.player?.name ?? '—'}
              </span>
              <span className="team-card__badge">
                {m.isCaptain ? 'C' : m.isSub ? 'sub' : ''}
              </span>
            </div>
          ))
        )}
      </div>
      <div className="team-card__foot">
        <span>{team.division?.name ?? '—'}</span>
        {team.org?.name && <span>· {team.org.name}</span>}
      </div>
    </div>
  );
}

function DepthChart({ team }) {
  if (!team) return null;
  const accentColor = team.org?.accentColor ?? '#1040aa';
  const members = [...(team.members ?? [])].sort((a, b) => roleSort(a, b));

  return (
    <div className="depth">
      <div className="depth__head">
        <span style={{ color: '#ffd400' }}>{team.tag}</span>
        &nbsp;{team.name} — Depth Chart
        <span style={{ opacity: 0.6, fontSize: 10 }}>{team.division?.name}</span>
      </div>
      {members.length === 0 ? (
        <div style={{ padding: '16px 12px', fontFamily: 'Share Tech Mono, monospace', fontSize: 10, opacity: 0.5, textAlign: 'center', textTransform: 'uppercase' }}>
          No roster data
        </div>
      ) : (
        members.map(m => (
          <div key={m.id} className="depth__row">
            <div className="depth__role">{m.role ?? m.player?.role}</div>
            <div className="depth__name">{m.player?.name ?? '—'}</div>
            <div className="depth__flag">
              {m.isCaptain && <span style={{ color: accentColor }}>Capt</span>}
              {m.isSub && <span style={{ opacity: 0.55 }}>Sub</span>}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function FreeAgentRow({ player }) {
  return (
    <div className="free-agent-row">
      <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.6 }}>
        {player.role ?? '—'}
      </span>
      <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 11 }}>
        {player.name}
      </span>
      <span style={{ fontFamily: 'VT323, monospace', fontSize: 11, opacity: 0.5 }}>
        {player.discordUsername ?? ''}
      </span>
    </div>
  );
}

export default function RosterClient({ activeSeason, teams, freeAgents }) {
  const dbError = teams === null && activeSeason !== null;
  const allTeams = teams ?? [];
  const allFreeAgents = freeAgents ?? [];

  const divisions = activeSeason?.divisions?.map(d => d.name) ?? [];
  const [divFilter, setDivFilter] = useState('ALL');
  const [focusTeamId, setFocusTeamId] = useState(null);

  const filteredTeams = divFilter === 'ALL'
    ? allTeams
    : allTeams.filter(t => t.division?.name === divFilter);

  const focusTeam = focusTeamId
    ? allTeams.find(t => t.id === focusTeamId)
    : filteredTeams[0] ?? null;

  return (
    <div>
      {/* Masthead */}
      <div className="frh-page-masthead" style={{ borderLeft: '6px solid #8bbf28' }}>
        <div className="frh-page-masthead__title">📋 Roster</div>
        <div className="frh-page-masthead__sub">
          {activeSeason ? activeSeason.name : 'Media Guide'} &middot; Full Team Rosters &middot; Free Agents
        </div>
        <div className="frh-page-masthead__stats">
          <div className="frh-statchip">
            <span className="frh-statchip__val">{allTeams.length}</span>
            <span className="frh-statchip__lbl">Teams</span>
          </div>
          <div className="frh-statchip">
            <span className="frh-statchip__val">
              {allTeams.reduce((n, t) => n + (t.members?.length ?? 0), 0)}
            </span>
            <span className="frh-statchip__lbl">Rostered</span>
          </div>
          <div className="frh-statchip">
            <span className="frh-statchip__val">{allFreeAgents.length}</span>
            <span className="frh-statchip__lbl">Free Agents</span>
          </div>
          <div className="frh-statchip">
            <span className="frh-statchip__val">{divisions.length}</span>
            <span className="frh-statchip__lbl">Divisions</span>
          </div>
        </div>
      </div>

      <div className="frh-editorial-shell">
        {!activeSeason && !dbError && (
          <div style={{ textAlign: 'center', padding: '48px 20px' }}>
            <div style={{ fontFamily: 'Boogaloo, cursive', fontSize: 24, marginBottom: 8 }}>
              📆 Season Not Yet Active
            </div>
            <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 10, opacity: 0.6, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Rosters will appear here once a season kicks off.
            </div>
            <Link href="/" style={{ display: 'block', marginTop: 16, color: '#1040aa', fontFamily: 'Share Tech Mono, monospace', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              ← Back to Home
            </Link>
          </div>
        )}

        {dbError && (
          <div style={{ textAlign: 'center', padding: '40px 0', fontFamily: 'Share Tech Mono, monospace', fontSize: 11, opacity: 0.6 }}>
            Roster data unavailable — database may be unreachable.{' '}
            <Link href="/" style={{ color: '#1040aa' }}>← Back to Home</Link>
          </div>
        )}

        {activeSeason && !dbError && (
          <>
            {/* Division filter chips */}
            {divisions.length > 1 && (
              <div className="filter-chips">
                <button
                  className={`filter-chip${divFilter === 'ALL' ? ' is-active' : ''}`}
                  onClick={() => { setDivFilter('ALL'); setFocusTeamId(null); }}
                >
                  All Divisions
                </button>
                {divisions.map(div => (
                  <button
                    key={div}
                    className={`filter-chip${divFilter === div ? ' is-active' : ''}`}
                    onClick={() => { setDivFilter(div); setFocusTeamId(null); }}
                  >
                    {div}
                  </button>
                ))}
              </div>
            )}

            {/* Depth chart for focused team */}
            {focusTeam && (
              <div style={{ marginBottom: 20 }}>
                <DepthChart team={focusTeam} />
                {filteredTeams.length > 1 && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    {filteredTeams.map(t => (
                      <button
                        key={t.id}
                        onClick={() => setFocusTeamId(t.id)}
                        style={{
                          fontFamily: 'Share Tech Mono, monospace',
                          fontSize: 9,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          padding: '2px 8px',
                          border: '2px solid #141414',
                          background: focusTeam.id === t.id ? '#ffd400' : 'var(--frh-paper-alt)',
                          cursor: 'pointer',
                          boxShadow: focusTeam.id === t.id ? 'none' : '2px 2px 0 #141414',
                        }}
                      >
                        {t.tag}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Team cards grid */}
            <div style={{ marginBottom: 8 }}>
              <div className="frh-section-label">
                <span className="frh-section-label__pill">TEAMS</span>
                <span className="frh-section-label__title">
                  {divFilter === 'ALL' ? 'All Teams' : divFilter}
                </span>
                <span className="frh-section-label__after">{filteredTeams.length} teams</span>
              </div>
            </div>

            {filteredTeams.length > 0 ? (
              <div className="teams-grid" style={{ marginBottom: 24 }}>
                {filteredTeams.map(team => (
                  <TeamCard key={team.id} team={team} />
                ))}
              </div>
            ) : (
              <div className="frh-panel" style={{ marginBottom: 24 }}>
                <div className="frh-panel__body" style={{ textAlign: 'center', padding: '32px 20px' }}>
                  <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 10, opacity: 0.55, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    No teams in this division yet.
                  </div>
                </div>
              </div>
            )}

            {/* Free agents */}
            <div style={{ marginBottom: 8 }}>
              <div className="frh-section-label">
                <span className="frh-section-label__pill">FA</span>
                <span className="frh-section-label__title">Free Agents</span>
                <span className="frh-section-label__after">{allFreeAgents.length} available</span>
              </div>
            </div>

            <div className="frh-panel" style={{ marginBottom: 24 }}>
              <header className="frh-panel__titlebar frh-panel__titlebar--gray" style={{ background: '#5C6B2E' }}>
                <div className="frh-panel__ttl">
                  <span className="frh-panel__accent" />
                  Unaffiliated Players
                </div>
                <div className="frh-panel__chips">
                  <span className="frh-panel__chip">_</span>
                  <span className="frh-panel__chip">&#9633;</span>
                  <span className="frh-panel__chip">&times;</span>
                </div>
              </header>
              <div className="frh-panel__body" style={{ padding: 0 }}>
                {allFreeAgents.length === 0 ? (
                  <div style={{ padding: '20px 12px', textAlign: 'center', fontFamily: 'Share Tech Mono, monospace', fontSize: 10, opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    No free agents — everyone&apos;s on a team
                  </div>
                ) : (
                  <div className="free-agents-list">
                    {allFreeAgents.map(p => <FreeAgentRow key={p.id} player={p} />)}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
