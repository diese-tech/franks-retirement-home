'use client';

import Image from 'next/image';
import Link from 'next/link';

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function MugShot({ player }) {
  const src = player?.avatarUrl ?? '/no_data.png';
  const name = player?.name ?? 'Unknown Subject';
  return (
    <div className="case-file__mug">
      <Image
        src={src}
        alt={name}
        width={136}
        height={136}
        unoptimized
        style={{ objectFit: 'cover' }}
      />
      <div className="case-file__mug__meta">
        <strong>Subject</strong>
        {name}
        {player?.id && (
          <>
            <strong style={{ marginTop: 6 }}>ID</strong>
            <span style={{ fontFamily: 'VT323, monospace', fontSize: 11 }}>
              {player.id.slice(0, 8).toUpperCase()}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function CaseFile({ c, featured = false }) {
  const charges = c.charge ? [c.charge] : [];

  return (
    <div className="case-file" style={{ marginBottom: featured ? 0 : 12 }}>
      <div className="case-file__head">
        <span>
          CASE #{c.id.slice(0, 6).toUpperCase()} &middot;{' '}
          {formatDate(c.publishedAt ?? c.createdAt)}
          {c.relatedTeam && ` · ${c.relatedTeam.name}`}
        </span>
        <span className="case-file__head__verdict">
          {c.status === 'published' ? 'ACTIVE' : c.status.toUpperCase()}
        </span>
      </div>
      <div className="case-file__layout">
        <MugShot player={c.relatedPlayer} />
        <div className="case-file__body">
          <h2>{c.title}</h2>
          {charges.length > 0 && (
            <div className="case-file__charges">
              {charges.map((charge, i) => (
                <div key={i} className="case-file__charge-item">{charge}</div>
              ))}
            </div>
          )}
          {c.body && (
            <div className="case-file__body-text">
              {c.body.split('\n').map((para, i) => (
                <p key={i} style={{ marginBottom: 6 }}>{para}</p>
              ))}
            </div>
          )}
          {c.signalSource && typeof c.signalSource === 'object' && (
            <div style={{
              marginTop: 10,
              padding: '8px 10px',
              background: '#CC330010',
              border: '1px solid #CC330030',
              fontFamily: 'Share Tech Mono, monospace',
              fontSize: 9,
              letterSpacing: '0.05em',
            }}>
              <div style={{ color: '#CC3300', marginBottom: 4, textTransform: 'uppercase' }}>
                📊 Stat Signal
              </div>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', opacity: 0.75 }}>
                {JSON.stringify(c.signalSource, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function WantedPoster({ c }) {
  const src = c.relatedPlayer?.avatarUrl ?? '/no_data.png';
  return (
    <div style={{
      border: '3px solid #141414',
      background: '#FFFCF5',
      padding: 10,
      textAlign: 'center',
      boxShadow: '4px 4px 0 #141414',
      minWidth: 120,
    }}>
      <div style={{
        fontFamily: 'Boogaloo, cursive',
        fontSize: 11,
        letterSpacing: '0.15em',
        color: '#CC3300',
        marginBottom: 4,
        textTransform: 'uppercase',
      }}>
        ⚠ Wanted
      </div>
      <Image
        src={src}
        alt={c.relatedPlayer?.name ?? 'Unknown'}
        width={80}
        height={80}
        unoptimized
        style={{ objectFit: 'cover', border: '2px solid #141414', display: 'block', margin: '0 auto 6px' }}
      />
      <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        {c.relatedPlayer?.name ?? 'Unknown Subject'}
      </div>
      {c.charge && (
        <div style={{ fontSize: 9, opacity: 0.65, marginTop: 2 }}>{c.charge}</div>
      )}
    </div>
  );
}

export default function FraudWatchClient({ fraudCases, washedCases, totalCount, activeCount }) {
  const dbError = fraudCases === null;
  const allFraud = fraudCases ?? [];
  const allWashed = washedCases ?? [];

  const featuredCase = allFraud[0] ?? null;
  const wantedCases = allFraud.slice(1);
  const archivedCases = allFraud.filter(c => c.status === 'archived');

  return (
    <div>
      {/* Masthead */}
      <div className="frh-page-masthead" style={{ borderLeft: '6px solid #CC3300' }}>
        <div className="frh-page-masthead__title">🚨 Fraud Watch</div>
        <div className="frh-page-masthead__sub">
          Stat-Signal Intelligence &middot; Active Investigations &middot; Hall of Shame
        </div>
        <div className="frh-page-masthead__stats">
          <div className="frh-statchip">
            <span className="frh-statchip__val">{activeCount}</span>
            <span className="frh-statchip__lbl">Active</span>
          </div>
          <div className="frh-statchip">
            <span className="frh-statchip__val">{totalCount}</span>
            <span className="frh-statchip__lbl">Total Cases</span>
          </div>
          <div className="frh-statchip">
            <span className="frh-statchip__val">{allWashed.length}</span>
            <span className="frh-statchip__lbl">Washed Reports</span>
          </div>
          <div className="frh-statchip">
            <span className="frh-statchip__val">{archivedCases.length}</span>
            <span className="frh-statchip__lbl">Closed</span>
          </div>
        </div>
      </div>

      <div className="frh-editorial-shell">
        {dbError && (
          <div style={{ textAlign: 'center', padding: '40px 0', fontFamily: 'Share Tech Mono, monospace', fontSize: 11, opacity: 0.6 }}>
            Case files unavailable — database may be unreachable.{' '}
            <Link href="/" style={{ color: '#1040aa' }}>← Back to Home</Link>
          </div>
        )}

        {!dbError && (
          <>
            {/* Featured case + sidebar */}
            <div style={{ marginBottom: 8 }}>
              <div className="frh-section-label frh-section-label--alert">
                <span className="frh-section-label__pill">HOT</span>
                <span className="frh-section-label__title">Featured Case</span>
              </div>
            </div>

            {featuredCase ? (
              <div className="case-grid" style={{ marginBottom: 24 }}>
                <CaseFile c={featuredCase} featured />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* Tip box */}
                  <div className="tip-box">
                    <div className="tip-box__head">📬 Submit a Tip</div>
                    <div className="tip-box__note">
                      Witnessed suspicious stat-padding, intentional feeding, or general
                      fraud activity? Report it to the FRH Integrity Bureau.
                    </div>
                    <div style={{
                      fontFamily: 'Share Tech Mono, monospace',
                      fontSize: 9,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      opacity: 0.5,
                    }}>
                      Tip submissions coming soon
                    </div>
                  </div>

                  {/* Recent verdicts sidebar */}
                  <div className="verdict-ledger">
                    <div className="verdict-ledger__head">Recent Verdicts</div>
                    {allFraud.length === 0 ? (
                      <div style={{ padding: '10px 12px', fontFamily: 'Share Tech Mono, monospace', fontSize: 10, opacity: 0.5 }}>
                        No verdicts yet
                      </div>
                    ) : allFraud.slice(0, 6).map(c => (
                      <div key={c.id} className="verdict-ledger__row">
                        <div className="verdict-ledger__who">
                          {c.relatedPlayer?.name ?? c.title}
                        </div>
                        <div className="verdict-ledger__note">
                          {formatDate(c.publishedAt)}
                        </div>
                        <div className={`verdict-ledger__verdict ${c.status === 'archived' ? 'cleared' : 'pending'}`}>
                          {c.status === 'archived' ? 'Closed' : 'Active'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="frh-panel" style={{ marginBottom: 24 }}>
                <div className="frh-panel__body" style={{ textAlign: 'center', padding: '48px 20px' }}>
                  <div style={{ fontFamily: 'Boogaloo, cursive', fontSize: 24, marginBottom: 8 }}>
                    🟢 All Clear
                  </div>
                  <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 10, opacity: 0.6, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    No active fraud cases. The league is clean... for now.
                  </div>
                </div>
              </div>
            )}

            {/* Active wanted strip */}
            {wantedCases.length > 0 && (
              <>
                <div style={{ marginBottom: 8 }}>
                  <div className="frh-section-label frh-section-label--alert">
                    <span className="frh-section-label__pill">OPEN</span>
                    <span className="frh-section-label__title">Active Investigations</span>
                    <span className="frh-section-label__after">{wantedCases.length} cases</span>
                  </div>
                </div>
                <div style={{
                  display: 'flex',
                  gap: 12,
                  overflowX: 'auto',
                  padding: '4px 0 12px',
                  marginBottom: 24,
                }}>
                  {wantedCases.map(c => <WantedPoster key={c.id} c={c} />)}
                </div>
              </>
            )}

            {/* Washed reports */}
            {allWashed.length > 0 && (
              <>
                <div style={{ marginBottom: 8 }}>
                  <div className="frh-section-label">
                    <span className="frh-section-label__pill">WASH</span>
                    <span className="frh-section-label__title">Washed Reports</span>
                    <span className="frh-section-label__after">{allWashed.length} filed</span>
                  </div>
                </div>
                <div className="shame-grid" style={{ marginBottom: 24 }}>
                  {allWashed.map(c => (
                    <div key={c.id} className="shame">
                      <Image
                        src={c.relatedPlayer?.avatarUrl ?? '/no_data.png'}
                        alt={c.relatedPlayer?.name ?? c.title}
                        width={64}
                        height={64}
                        unoptimized
                        className="shame__img"
                      />
                      <div className="shame__year">
                        {c.publishedAt ? new Date(c.publishedAt).getFullYear() : '—'}
                      </div>
                      <div className="shame__name">
                        {c.relatedPlayer?.name ?? c.title}
                      </div>
                      {c.charge && <div className="shame__charge">{c.charge}</div>}
                    </div>
                  ))}
                </div>
              </>
            )}

            {allFraud.length === 0 && allWashed.length === 0 && (
              <div className="frh-panel">
                <div className="frh-panel__body" style={{ textAlign: 'center', padding: '48px 20px' }}>
                  <div style={{ fontFamily: 'Boogaloo, cursive', fontSize: 24, marginBottom: 8 }}>
                    📁 No Cases Filed
                  </div>
                  <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 10, opacity: 0.6, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    Fraud Watch cases will appear here once published.
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
