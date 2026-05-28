'use client';

import Link from 'next/link';

function formatOdds(n) {
  if (!n && n !== 0) return 'EVEN';
  return n >= 0 ? `+${n}` : `${n}`;
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function SlateRow({ line, featured }) {
  const teamA = line.teamA;
  const teamB = line.teamB;
  const when = line.match?.scheduledAt ? formatDate(line.match.scheduledAt) : 'TBD';
  return (
    <div className={`slate-row${featured ? ' is-featured' : ''}`}>
      <div className="slate-row__when">{when}</div>
      <div className="slate-row__team">
        <span className="slate-row__tag">{teamA?.tag ?? '???'}</span>
        <span style={{ fontSize: 10, opacity: 0.8 }}>{teamA?.name ?? 'Team A'}</span>
      </div>
      <div className="slate-row__team">
        <span className="slate-row__tag">{teamB?.tag ?? '???'}</span>
        <span style={{ fontSize: 10, opacity: 0.8 }}>{teamB?.name ?? 'Team B'}</span>
      </div>
      <div className="slate-row__line">
        {formatOdds(line.teamAOdds)} / {formatOdds(line.teamBOdds)}
      </div>
      <div className="slate-row__ou">{line.match?.division?.name ?? ''}</div>
    </div>
  );
}

export default function KnowsBallClient({ lines, lineCount, editorial }) {
  const dbError = lines === null;
  const openLines = lines ?? [];
  const lockItem = Array.isArray(editorial) && editorial.length > 0 ? editorial[0] : null;

  return (
    <div>
      {/* Masthead */}
      <div className="frh-page-masthead" style={{ borderLeft: '6px solid #ffd400' }}>
        <div className="frh-page-masthead__title">🏆 Knows Ball</div>
        <div className="frh-page-masthead__sub">
          Fantasy Team Odds &middot; Weekly Slate &middot; Lock of the Week
        </div>
        <div className="frh-page-masthead__stats">
          <div className="frh-statchip">
            <span className="frh-statchip__val">{lineCount}</span>
            <span className="frh-statchip__lbl">Open Lines</span>
          </div>
          <div className="frh-statchip">
            <span className="frh-statchip__val">{openLines.length}</span>
            <span className="frh-statchip__lbl">This Week</span>
          </div>
          <div className="frh-statchip">
            <span className="frh-statchip__val">{lockItem ? 1 : 0}</span>
            <span className="frh-statchip__lbl">Lock</span>
          </div>
        </div>
      </div>

      <div className="frh-editorial-shell">
        {dbError && (
          <div style={{ textAlign: 'center', padding: '40px 0', fontFamily: 'Share Tech Mono, monospace', fontSize: 11, opacity: 0.6 }}>
            Lines unavailable — database may be unreachable.{' '}
            <Link href="/" style={{ color: '#1040aa' }}>← Back to Home</Link>
          </div>
        )}

        {!dbError && (
          <>
            {/* Weekly Slate label */}
            <div style={{ marginBottom: 8 }}>
              <div className="frh-section-label">
                <span className="frh-section-label__pill">LIVE</span>
                <span className="frh-section-label__title">Weekly Slate</span>
                {openLines.length > 0 && (
                  <span className="frh-section-label__after">{openLines.length} games</span>
                )}
              </div>
            </div>

            <div className="kb-layout" style={{ marginBottom: 24 }}>
              {/* Slate */}
              <div className="frh-panel">
                <header className="frh-panel__titlebar frh-panel__titlebar--blue">
                  <div className="frh-panel__ttl">
                    <span className="frh-panel__accent" />
                    Games &amp; Lines
                  </div>
                  <div className="frh-panel__chips">
                    <span className="frh-panel__chip">_</span>
                    <span className="frh-panel__chip">&#9633;</span>
                    <span className="frh-panel__chip">&times;</span>
                  </div>
                </header>
                <div className="frh-panel__body" style={{ padding: 0 }}>
                  {/* Column headers */}
                  <div className="slate-row" style={{ borderBottom: '2px solid #14141430', background: 'var(--frh-paper-alt)', cursor: 'default' }}>
                    <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.55 }}>When</div>
                    <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.55 }}>Team A</div>
                    <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.55 }}>Team B</div>
                    <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.55, textAlign: 'center' }}>Odds</div>
                    <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.55, textAlign: 'right' }}>Div</div>
                  </div>
                  {openLines.length > 0 ? (
                    openLines.map((line, i) => (
                      <SlateRow key={line.id} line={line} featured={i === 0} />
                    ))
                  ) : (
                    <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                      <div style={{ fontFamily: 'Boogaloo, cursive', fontSize: 20, marginBottom: 6 }}>
                        📭 No Open Lines
                      </div>
                      <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 10, opacity: 0.55, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        Lines open when matches are scheduled.
                      </div>
                    </div>
                  )}
                </div>
                <div className="frh-panel__statusbar">
                  <span>No real money. FRH fantasy points only.</span>
                </div>
              </div>

              {/* Lock of the week */}
              {lockItem ? (
                <div className="lock">
                  <div className="lock__head">
                    🔒 Lock of the Week
                  </div>
                  <div className="lock__body">
                    <div className="lock__pick">{lockItem.pick ?? 'TBD'}</div>
                    {lockItem.line && <div className="lock__line">{lockItem.line}</div>}
                    {lockItem.why && <div className="lock__why">{lockItem.why}</div>}
                    {lockItem.by && <div className="lock__signed">— {lockItem.by}</div>}
                  </div>
                </div>
              ) : (
                <div className="lock">
                  <div className="lock__head">🔒 Lock of the Week</div>
                  <div className="lock__body" style={{ textAlign: 'center', padding: '24px 12px' }}>
                    <div style={{ fontFamily: 'Boogaloo, cursive', fontSize: 16, opacity: 0.6 }}>
                      No lock posted yet
                    </div>
                    <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 9, opacity: 0.45, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 4 }}>
                      Editors will post a pick before lock
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Analyst Leaderboard + Props Market */}
            <div style={{ marginBottom: 8 }}>
              <div className="frh-section-label">
                <span className="frh-section-label__pill">STATS</span>
                <span className="frh-section-label__title">Analyst Standings</span>
              </div>
            </div>

            <div className="col-split-60" style={{ marginBottom: 24 }}>
              {/* Analyst leaderboard */}
              <div className="frh-panel">
                <header className="frh-panel__titlebar frh-panel__titlebar--purple">
                  <div className="frh-panel__ttl">
                    <span className="frh-panel__accent" />
                    Analyst Leaderboard
                  </div>
                  <div className="frh-panel__chips">
                    <span className="frh-panel__chip">_</span>
                    <span className="frh-panel__chip">&#9633;</span>
                    <span className="frh-panel__chip">&times;</span>
                  </div>
                </header>
                <div className="frh-panel__body" style={{ padding: 0 }}>
                  <div className="ab is-head">
                    <div className="ab__rank">#</div>
                    <div className="ab__who">Handle</div>
                    <div className="ab__bio">Analyst</div>
                    <div className="ab__num">W</div>
                    <div className="ab__num">L</div>
                    <div className="ab__num">ATS</div>
                  </div>
                  <div style={{ padding: '24px 12px', textAlign: 'center' }}>
                    <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 10, opacity: 0.5, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      No analysts registered yet.
                      <br />Analyst profiles coming soon.
                    </div>
                  </div>
                </div>
              </div>

              {/* Props market */}
              <div className="frh-panel">
                <header className="frh-panel__titlebar frh-panel__titlebar--orange">
                  <div className="frh-panel__ttl">
                    <span className="frh-panel__accent" />
                    Props Market
                  </div>
                  <div className="frh-panel__chips">
                    <span className="frh-panel__chip">_</span>
                    <span className="frh-panel__chip">&#9633;</span>
                    <span className="frh-panel__chip">&times;</span>
                  </div>
                </header>
                <div className="frh-panel__body" style={{ padding: '24px 12px', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 10, opacity: 0.5, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    Player props coming in a future update.
                  </div>
                </div>
              </div>
            </div>

            {/* Disclaimer */}
            <div style={{
              fontFamily: 'Share Tech Mono, monospace',
              fontSize: 9,
              letterSpacing: '0.06em',
              opacity: 0.45,
              textAlign: 'center',
              paddingBottom: 8,
            }}>
              FRH fantasy points only · No real money · Wallet opens on first bet
            </div>
          </>
        )}
      </div>
    </div>
  );
}
