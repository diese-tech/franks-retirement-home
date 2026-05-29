'use client';

import Link from 'next/link';
import Image from 'next/image';
import { BrutalButton, StatusBadge } from '@/components/ui';
import EditableField from '@/components/EditableField';
import { getTeamLogo } from '@/lib/teamLogos';
import {
  DEFAULT_TICKER,
  DEFAULT_HEADLINES,
  DEFAULT_BULLETIN,
  DEFAULT_FRAUD_WATCH,
  DEFAULT_MOTW,
  DEFAULT_RIVALRIES,
  DEFAULT_KNOWS_BALL,
  DEFAULT_WASHED_REPORTS,
  DEFAULT_SOCIAL_CARDS,
  DEFAULT_DISCORD_INVITE_URL,
  DEFAULT_WASHED_PCT,
} from '@/lib/homepageDefaults';

// Re-export defaults under legacy names so anything that previously imported
// from this file (e.g. tests) continues to work.
export {
  DEFAULT_TICKER   as TICKER_DATA,
  DEFAULT_HEADLINES as HEADLINES_DATA,
  DEFAULT_BULLETIN  as BULLETIN_DATA,
  DEFAULT_FRAUD_WATCH as FRAUD_DATA,
  DEFAULT_MOTW     as MOTW_DATA,
  DEFAULT_RIVALRIES as RIVALRY_DATA,
  DEFAULT_KNOWS_BALL as KNOWS_BALL_DATA,
  DEFAULT_WASHED_REPORTS as WASHED_DATA,
  DEFAULT_SOCIAL_CARDS   as SOCIAL_CARD_DATA,
};

// ─── Rankings placeholder (still used as DB fallback inside this file) ───────
const RANKINGS_DATA = [
  { rank:  1, team: 'Bedpan Bandits',        tag: 'BEDP', trend: +2, blurb: 'Undefeated. Annoying. Unwell.',              record: '5–0', color: '#CC3300' },
  { rank:  2, team: 'Whiskey Wardens',       tag: 'WHIS', trend:  0, blurb: "Drafts like they're at a wedding.",          record: '5–2', color: '#8a4a13' },
  { rank:  3, team: 'Late Stage Tyrants',    tag: 'TYRN', trend: +1, blurb: 'Mid-game pressure, late-game vibes.',        record: '4–2', color: '#3a2a6a' },
  { rank:  4, team: 'Centennial Centurions', tag: 'CENT', trend: -2, blurb: 'Old money. Older instincts.',                record: '4–3', color: '#5C6B2E' },
  { rank:  5, team: 'Sundown Saboteurs',     tag: 'SUND', trend:  0, blurb: 'Peak at 10pm EST. Falls off at 11.',         record: '4–3', color: '#2B5BA8' },
  { rank:  6, team: 'Last Will & Tower',     tag: 'WILL', trend: +3, blurb: 'Surprise contender. Surprised themselves.',  record: '3–3', color: '#5b3a13' },
  { rank:  7, team: 'Pillbox Phoenixes',     tag: 'PILL', trend: -1, blurb: 'Reborn weekly. Burned out by Sunday.',       record: '3–4', color: '#ff8c00' },
  { rank:  8, team: 'Geriatric Jormungandr', tag: 'JORM', trend: -3, blurb: 'Coiled. Confused.',                         record: '2–4', color: '#163b00' },
  { rank:  9, team: 'Mall Walkers',          tag: 'MALL', trend:  0, blurb: 'Lapped, literally and figuratively.',        record: '2–5', color: '#6f35ff' },
  { rank: 10, team: 'Sleep Apnea Sentinels', tag: 'SLEP', trend: -1, blurb: 'AFK by minute 14. Every game.',              record: '1–6', color: '#6B5A3E' },
];


// ─── Editor helpers ───────────────────────────────────────────────────────────

/** Reorder/remove button strip for list items in editor mode */
function ItemControls({ isEditor, idx, total, onMoveUp, onMoveDown, onRemove }) {
  if (!isEditor) return null;
  return (
    <span className="frh-item-controls" style={{ display: 'inline-flex', gap: 2, marginLeft: 6, verticalAlign: 'middle' }}>
      <button onClick={() => onMoveUp(idx)}   disabled={idx === 0}         title="Move up"   style={itemBtnStyle}>▲</button>
      <button onClick={() => onMoveDown(idx)} disabled={idx === total - 1} title="Move down" style={itemBtnStyle}>▼</button>
      <button onClick={() => onRemove(idx)}                                title="Remove"    style={{ ...itemBtnStyle, color: '#f87171' }}>✕</button>
    </span>
  );
}

const itemBtnStyle = {
  background: 'rgba(255,212,0,0.12)',
  border: '1px solid rgba(255,212,0,0.3)',
  color: '#ffd400',
  cursor: 'pointer',
  fontSize: 9,
  padding: '1px 4px',
  lineHeight: 1,
  borderRadius: 2,
};

function addBtn(label, onClick) {
  return (
    <button onClick={onClick} style={{
      marginTop: 6,
      background: 'rgba(255,212,0,0.1)',
      border: '1px dashed rgba(255,212,0,0.4)',
      color: '#ffd400',
      cursor: 'pointer',
      fontSize: 10,
      padding: '3px 10px',
      fontFamily: 'var(--font-mono)',
      width: '100%',
    }}>+ {label}</button>
  );
}

// Generic list mutation helpers used by the editor
function moveUp(arr, i)   { if (i === 0) return arr; const a = [...arr]; [a[i-1], a[i]] = [a[i], a[i-1]]; return a; }
function moveDown(arr, i) { if (i >= arr.length-1) return arr; const a = [...arr]; [a[i], a[i+1]] = [a[i+1], a[i]]; return a; }
function removeAt(arr, i) { return arr.filter((_, idx) => idx !== i); }
function updateAt(arr, i, patch) { return arr.map((item, idx) => idx === i ? { ...item, ...patch } : item); }


// ─── Sub-components ───────────────────────────────────────────────────────────

export function FrhTicker({ items, isEditor, onItemChange, onMoveUp, onMoveDown, onRemove, onAdd }) {
  const loop = [...items, ...items];
  return (
    <div className="frh-ticker">
      <div className="frh-ticker__label">
        FRH<span style={{ fontSize: 11, letterSpacing: '0.18em', marginLeft: 8 }}>WIRE</span>
      </div>
      {isEditor ? (
        <div style={{ flex: 1, padding: '6px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {items.map((it, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontFamily: 'var(--font-mono)' }}>
              <select value={it.tone} onChange={e => onItemChange(i, { tone: e.target.value })}
                style={{ background: '#111', border: '1px solid #333', color: '#ffd400', fontSize: 10, padding: '1px 2px' }}>
                {['score','alert','info'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <EditableField value={it.tag}  onEdit={v => onItemChange(i, { tag: v })}  placeholder="TAG"  style={{ width: 70 }} />
              <EditableField value={it.text} onEdit={v => onItemChange(i, { text: v })} placeholder="Ticker text…" style={{ flex: 1 }} />
              <ItemControls isEditor={isEditor} idx={i} total={items.length}
                onMoveUp={onMoveUp} onMoveDown={onMoveDown} onRemove={onRemove} />
            </div>
          ))}
          {addBtn('Add ticker item', onAdd)}
        </div>
      ) : (
        <div className="frh-ticker__track">
          <div className="frh-ticker__rail">
            {loop.map((it, i) => (
              <span key={i} className="frh-ticker__item">
                <span className={`frh-ticker__tag frh-ticker__tag--${it.tone}`}>{it.tag}</span>
                <span>{it.text}</span>
                {i % 3 === 2
                  ? <span style={{ color: '#ffd400' }}>&#9733;</span>
                  : <span style={{ opacity: 0.4 }}>&bull;</span>}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function FrhMasthead({ activeSeason, playerCount, matchCount, washedPct, isEditor, onWashedPctChange }) {
  const seasonNum = activeSeason?.name?.match(/\d+/)?.[0] ?? '9';
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
          <div className="frh-statchip__num">{playerCount ?? '—'}</div>
          <div className="frh-statchip__lbl">Players</div>
        </div>
        <div className="frh-statchip">
          <div className="frh-statchip__num">{matchCount ?? 0}</div>
          <div className="frh-statchip__lbl">Matches</div>
        </div>
        <div className="frh-statchip">
          <div className="frh-statchip__num">
            <EditableField
              value={washedPct ?? DEFAULT_WASHED_PCT}
              onEdit={isEditor ? onWashedPctChange : undefined}
              type="number" min={0} max={100}
              style={{ width: 44, textAlign: 'center' }}
            />
          </div>
          <div className="frh-statchip__lbl">Washed%</div>
        </div>
      </div>
    </header>
  );
}

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


export function FrhMegaScoreboard({ liveMatch, upcomingMatch }) {
  if (liveMatch) {
    const m = liveMatch;
    const homeColor = m.homeTeam?.accentColor ?? '#CC3300';
    const awayColor = m.awayTeam?.accentColor ?? '#2B5BA8';
    const homeLogo = getTeamLogo(m.homeTeam);
    const awayLogo = getTeamLogo(m.awayTeam);
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
            <div className="frh-mega__crest">{homeLogo ? <Image src={homeLogo} alt={`${m.homeTeam?.name ?? 'Home team'} logo`} width={84} height={84} /> : (m.homeTeam?.tag ?? '—')}</div>
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
            <div className="frh-mega__crest">{awayLogo ? <Image src={awayLogo} alt={`${m.awayTeam?.name ?? 'Away team'} logo`} width={84} height={84} /> : (m.awayTeam?.tag ?? '—')}</div>
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
    const homeLogo = getTeamLogo(m.homeTeam);
    const awayLogo = getTeamLogo(m.awayTeam);
    const dt = m.scheduledAt ? new Date(m.scheduledAt) : null;
    const dateStr = dt ? dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'TBD';
    const timeStr = dt ? dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
    return (
      <div className="frh-mega">
        <div className="frh-mega__topbar frh-mega__topbar--upcoming">
          UPCOMING &middot; {m.division?.name ?? 'FRH Pro Division'}
          <span className="right">{dateStr}{timeStr ? ` · ${timeStr}` : ''}</span>
        </div>
        <div className="frh-mega__teams">
          <div className="frh-mega__side" style={{ background: homeColor }}>
            <div className="frh-mega__crest">{homeLogo ? <Image src={homeLogo} alt={`${m.homeTeam?.name ?? 'Home team'} logo`} width={84} height={84} /> : (m.homeTeam?.tag ?? '—')}</div>
            <div>
              <div className="frh-mega__teamname">{m.homeTeam?.name ?? 'Home Team'}</div>
              <div className="frh-mega__record">HOME</div>
            </div>
          </div>
          <div className="frh-mega__center">
            <div className="frh-mega__period">NEXT UP</div>
            <div className="frh-mega__scores" style={{ fontSize: 48, letterSpacing: 4 }}>
              <span style={{ opacity: 0.3 }}>—</span>
              <span className="sep" style={{ fontSize: 28 }}>vs</span>
              <span style={{ opacity: 0.3 }}>—</span>
            </div>
            <div className="frh-mega__clock" style={{ fontSize: 20 }}>{dateStr}</div>
            <div className="frh-mega__period">{timeStr}</div>
          </div>
          <div className="frh-mega__side right" style={{ background: awayColor }}>
            <div className="frh-mega__crest">{awayLogo ? <Image src={awayLogo} alt={`${m.awayTeam?.name ?? 'Away team'} logo`} width={84} height={84} /> : (m.awayTeam?.tag ?? '—')}</div>
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
        <p style={{ margin: '0', opacity: 0.5, fontSize: 11 }}>*** STOP: 0xWASHED_OUT_DEEP (BEDPAN_BANDITS, 0x00000005, 0xFEEDC0DE)</p>
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
            <p>*** STOP: 0xWASHED_OUT_DEEP (BEDPAN_BANDITS, 0x00000005, 0xFEEDC0DE)</p>
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


export function FrhLeadStory({ h, isEditor, onChange }) {
  return (
    <article className="frh-lead-story">
      <div className="frh-lead-story__art">
        <span className="frh-lead-story__kicker">
          <EditableField value={h.kicker} onEdit={isEditor ? v => onChange({ kicker: v }) : undefined} placeholder="KICKER" />
        </span>
        <span className="frh-lead-story__placeholder">hero image</span>
      </div>
      <div className="frh-lead-story__body">
        <h2 className="frh-lead-story__title">
          <EditableField value={h.title} onEdit={isEditor ? v => onChange({ title: v }) : undefined} placeholder="Headline title…" multiline />
        </h2>
        <p className="frh-lead-story__blurb">
          <EditableField value={h.blurb} onEdit={isEditor ? v => onChange({ blurb: v }) : undefined} placeholder="Blurb…" multiline />
        </p>
        <div className="frh-lead-story__byline">
          BY <b><EditableField value={h.byline} onEdit={isEditor ? v => onChange({ byline: v }) : undefined} placeholder="Byline" style={{ width: 100 }} /></b>
          &middot; <EditableField value={h.time} onEdit={isEditor ? v => onChange({ time: v }) : undefined} placeholder="3h ago" style={{ width: 80 }} />
          &middot; 8 MIN READ
        </div>
      </div>
    </article>
  );
}

export function FrhSidebarStories({ items, isEditor, onItemChange, onMoveUp, onMoveDown, onRemove, onAdd }) {
  return (
    <div className="frh-sidebar-stories">
      {items.map((h, i) => (
        <article key={i} className="frh-sidebar-story">
          <span className="frh-sidebar-story__num">{(i + 2).toString().padStart(2, '0')}</span>
          <div style={{ flex: 1 }}>
            <span className="frh-sidebar-story__kicker">
              <EditableField value={h.kicker} onEdit={isEditor ? v => onItemChange(i, { kicker: v }) : undefined} placeholder="KICKER" style={{ width: 80 }} />
            </span>
            <h3 className="frh-sidebar-story__title">
              <EditableField value={h.title} onEdit={isEditor ? v => onItemChange(i, { title: v }) : undefined} placeholder="Title…" multiline />
            </h3>
            <div className="frh-sidebar-story__byline">
              BY <EditableField value={h.byline} onEdit={isEditor ? v => onItemChange(i, { byline: v }) : undefined} placeholder="Byline" style={{ width: 90 }} />
              &middot; <EditableField value={h.time} onEdit={isEditor ? v => onItemChange(i, { time: v }) : undefined} placeholder="time" style={{ width: 70 }} />
            </div>
          </div>
          <ItemControls isEditor={isEditor} idx={i} total={items.length}
            onMoveUp={onMoveUp} onMoveDown={onMoveDown} onRemove={onRemove} />
        </article>
      ))}
      {isEditor && addBtn('Add sidebar story', onAdd)}
    </div>
  );
}

export function FrhBulletinForum({ items, isEditor, onItemChange, onMoveUp, onMoveDown, onRemove, onAdd }) {
  const sticky = {
    tag: 'PSA', user: 'FrankBot',
    title: 'READ FIRST · league rules, draft etiquette, and which gods we ban on sight',
    replies: 312, hot: false, sticky: true,
  };
  const rows = [sticky, ...items];
  return (
    <div className="frh-forum">
      <div className="frh-forum__head">
        <h3>THE BULLETIN BOARD</h3>
        <span className="right">7 ACTIVE &middot; POST &rarr;</span>
      </div>
      <div className="frh-forum__legend">
        <span>TAG</span><span>THREAD</span><span>REPLIES</span><span>HOT</span>
      </div>
      {rows.map((b, rowIdx) => {
        const i = rowIdx - 1; // sticky is index -1 (not editable)
        const editable = isEditor && !b.sticky;
        return (
          <div key={rowIdx} className={`frh-forum__post${b.sticky ? ' frh-forum__post--sticky' : ''}`}>
            <span className={`frh-forum__tag frh-forum__tag--${b.tag}`}>
              {editable
                ? <EditableField value={b.tag} onEdit={v => onItemChange(i, { tag: v })} style={{ width: 44 }} />
                : b.tag}
            </span>
            <span className="frh-forum__title">
              <b>
                {editable
                  ? <EditableField value={b.title} onEdit={v => onItemChange(i, { title: v })} multiline />
                  : b.title}
              </b>
              <span className="frh-forum__author">
                @{editable
                  ? <EditableField value={b.user} onEdit={v => onItemChange(i, { user: v })} style={{ width: 100 }} />
                  : b.user}
                &middot; 2h ago
              </span>
            </span>
            <span className="frh-forum__replies">
              {editable
                ? <EditableField value={b.replies} onEdit={v => onItemChange(i, { replies: Number(v) })} type="number" min={0} style={{ width: 44 }} />
                : b.replies}
              <span>replies</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              {editable ? (
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 10 }}>
                  <input type="checkbox" checked={!!b.hot} onChange={e => onItemChange(i, { hot: e.target.checked })} />
                  HOT
                </label>
              ) : b.hot
                ? <span className="frh-forum__hot">&#9733; HOT</span>
                : <span style={{ color: 'var(--frh-text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>&mdash;</span>}
              {editable && (
                <ItemControls isEditor={isEditor} idx={i} total={items.length}
                  onMoveUp={onMoveUp} onMoveDown={onMoveDown} onRemove={onRemove} />
              )}
            </span>
          </div>
        );
      })}
      <div className="frh-forum__foot">
        <span>&#8593; STICKY</span>
        <Link href="/bulletin-board" style={{ marginLeft: 'auto', color: '#ffd400', textDecoration: 'none' }}>
          VIEW ALL THREADS &rarr;
        </Link>
      </div>
      {isEditor && addBtn('Add bulletin post', onAdd)}
    </div>
  );
}


export function FrhFraudWanted({ items, isEditor, onItemChange, onMoveUp, onMoveDown, onRemove, onAdd }) {
  return (
    <div className="frh-fraud-wanted">
      <div className="frh-fraud-wanted__bar">
        <span>&#9733; FRAUD WATCH &middot; {items.length} ACTIVE CASES &#9733;</span>
        <small>JURISDICTION: ADMIN GREMLIN &middot; APPEALS CLOSED</small>
      </div>
      <div className="frh-fraud-wanted__row">
        {items.map((c, i) => (
          <div key={i} className="frh-wanted-card">
            <span className="frh-wanted-card__stamp">
              {c.level === 3 ? 'FRAUD' : c.level === 2 ? 'SUS' : 'WATCH'}
            </span>
            <div className="frh-wanted-card__top">WANTED</div>
            <div className="frh-wanted-card__mug">
              <span style={{ fontSize: 10, opacity: 0.5 }}></span>
              <span className="frh-wanted-card__case">CASE #{(i + 1).toString().padStart(3, '0')}</span>
            </div>
            <h4 className="frh-wanted-card__player">
              <EditableField value={c.player} onEdit={isEditor ? v => onItemChange(i, { player: v }) : undefined} placeholder="Player IGN" />
            </h4>
            <div className="frh-wanted-card__team">
              TEAM <EditableField value={c.team} onEdit={isEditor ? v => onItemChange(i, { team: v }) : undefined} placeholder="TAG" style={{ width: 44 }} />
            </div>
            <p className="frh-wanted-card__charge">
              &ldquo;<EditableField value={c.charge} onEdit={isEditor ? v => onItemChange(i, { charge: v }) : undefined} placeholder="Charge description…" multiline />&rdquo;
            </p>
            {isEditor && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: 10 }}>
                <label>Level:
                  <select value={c.level} onChange={e => onItemChange(i, { level: Number(e.target.value) })}
                    style={{ background: '#111', border: '1px solid #333', color: '#ffd400', marginLeft: 4 }}>
                    <option value={1}>1 WATCH</option>
                    <option value={2}>2 SUS</option>
                    <option value={3}>3 FRAUD</option>
                  </select>
                </label>
                <ItemControls isEditor={isEditor} idx={i} total={items.length}
                  onMoveUp={onMoveUp} onMoveDown={onMoveDown} onRemove={onRemove} />
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 8, textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        <Link href="/fraud-watch" style={{ color: '#ffd400', textDecoration: 'none' }}>Open full case board &rarr;</Link>
      </div>
      {isEditor && addBtn('Add fraud case', onAdd)}
    </div>
  );
}

export function FrhMotwMega({ motw, isEditor, onChange }) {
  return (
    <div className="frh-motw-mega">
      <div className="frh-motw-mega__poster">
        <span className="frh-motw-mega__kicker">FRI NIGHT &middot; PRIMETIME &middot; 9:00 PM EST</span>
        <div>
          <h2 className="frh-motw-mega__matchup">
            <EditableField value={motw.title} onEdit={isEditor ? v => onChange({ title: v }) : undefined} placeholder="TEAM A vs TEAM B" />
          </h2>
          <div className="frh-motw-mega__when">
            <EditableField value={motw.when} onEdit={isEditor ? v => onChange({ when: v }) : undefined} placeholder="FRI · 9:00 PM EST" />
          </div>
          <p className="frh-motw-mega__story">
            <EditableField value={motw.storyline} onEdit={isEditor ? v => onChange({ storyline: v }) : undefined} placeholder="Storyline…" multiline />
          </p>
        </div>
        <div className="frh-motw-mega__cta">
          <button className="frh-btn frh-btn--primary">&#9733; REMIND ME</button>
          <button className="frh-btn">SHARE CARD</button>
          <button className="frh-btn">WATCH LIVE &rarr;</button>
        </div>
      </div>
      <div className="frh-motw-mega__details">
        <div className="frh-motw-mega__h2h">
          <div className="frh-motw-mega__sectionhead">RECENT HEAD-TO-HEAD</div>
          <ul>
            {(motw.h2h ?? []).map((h, i) => (
              <li key={i}>
                <span>
                  <EditableField value={h.season} onEdit={isEditor ? v => onChange({ h2h: updateAt(motw.h2h, i, { season: v }) }) : undefined} style={{ width: 30 }} />
                </span>
                <span>
                  <EditableField value={h.result} onEdit={isEditor ? v => onChange({ h2h: updateAt(motw.h2h, i, { result: v }) }) : undefined} style={{ width: 120 }} />
                </span>
                {isEditor && (
                  <button onClick={() => onChange({ h2h: removeAt(motw.h2h, i) })} style={{ ...itemBtnStyle, color: '#f87171', marginLeft: 4 }}>✕</button>
                )}
              </li>
            ))}
          </ul>
          {isEditor && addBtn('Add H2H result', () => onChange({ h2h: [...(motw.h2h ?? []), { season: 'S9', result: '' }] }))}
        </div>
        <div>
          <div className="frh-motw-mega__sectionhead">STAKES</div>
          <div className="frh-motw-mega__stakes">
            <b>WHAT&apos;S ON THE LINE</b>
            <EditableField value={motw.stakes} onEdit={isEditor ? v => onChange({ stakes: v }) : undefined} placeholder="Stakes…" multiline />
          </div>
        </div>
        <div>
          <div className="frh-motw-mega__sectionhead">KNOWS BALL LINE</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.6 }}>
            BEDP -3.5 &middot; OVER/UNDER 28 min &middot; &ldquo;Bandits cover, Tyrants force G3&rdquo;
          </div>
        </div>
      </div>
    </div>
  );
}

export function FrhRivalryPosters({ items, isEditor, onItemChange, onMoveUp, onMoveDown, onRemove, onAdd }) {
  return (
    <div className="frh-rivalry-row">
      {items.map((r, i) => (
        <div key={i} className="frh-poster">
          <div className="frh-poster__matchup">
            <div className="frh-poster__side" style={{ background: r.colors[0] }}>
              <div className="frh-poster__crest">
                <EditableField value={r.tags[0]} onEdit={isEditor ? v => onItemChange(i, { tags: [v, r.tags[1]] }) : undefined} style={{ width: 44 }} />
              </div>
              <div>
                <EditableField value={r.teams[0]} onEdit={isEditor ? v => onItemChange(i, { teams: [v, r.teams[1]] }) : undefined} />
              </div>
            </div>
            <div className="frh-poster__vs">VS</div>
            <div className="frh-poster__side right" style={{ background: r.colors[1] }}>
              <div className="frh-poster__crest">
                <EditableField value={r.tags[1]} onEdit={isEditor ? v => onItemChange(i, { tags: [r.tags[0], v] }) : undefined} style={{ width: 44 }} />
              </div>
              <div>
                <EditableField value={r.teams[1]} onEdit={isEditor ? v => onItemChange(i, { teams: [r.teams[0], v] }) : undefined} />
              </div>
            </div>
          </div>
          <div className="frh-poster__title">
            <EditableField value={r.title} onEdit={isEditor ? v => onItemChange(i, { title: v }) : undefined} placeholder="Rivalry title" />
          </div>
          <div className="frh-poster__note">
            <EditableField value={r.note} onEdit={isEditor ? v => onItemChange(i, { note: v }) : undefined} placeholder="Rivalry note…" multiline />
            <div className="frh-poster__rec">
              <b>ALL-TIME</b>
              <span>
                <EditableField value={r.record} onEdit={isEditor ? v => onItemChange(i, { record: v }) : undefined} placeholder="TEAM A 0 — TEAM B 0" />
              </span>
            </div>
          </div>
          {isEditor && (
            <div style={{ display: 'flex', gap: 4, marginTop: 6, fontSize: 10, flexWrap: 'wrap' }}>
              <label>Color 1: <input type="color" value={r.colors[0]} onChange={e => onItemChange(i, { colors: [e.target.value, r.colors[1]] })} style={{ width: 28, height: 18, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }} /></label>
              <label>Color 2: <input type="color" value={r.colors[1]} onChange={e => onItemChange(i, { colors: [r.colors[0], e.target.value] })} style={{ width: 28, height: 18, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }} /></label>
              <ItemControls isEditor={isEditor} idx={i} total={items.length}
                onMoveUp={onMoveUp} onMoveDown={onMoveDown} onRemove={onRemove} />
            </div>
          )}
        </div>
      ))}
      <div style={{ alignSelf: 'end', fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        <Link href="/schedule" style={{ color: '#ffd400', textDecoration: 'none' }}>See full slate &rarr;</Link>
      </div>
      {isEditor && addBtn('Add rivalry', onAdd)}
    </div>
  );
}


export function FrhSocialStrip({ items, isEditor, onItemChange, onMoveUp, onMoveDown, onRemove, onAdd }) {
  return (
    <div className="frh-social-strip">
      <div className="frh-social-strip__head">
        <h3>&#9733; AUTO-GENERATED MEDIA &middot; TAP TO SHARE</h3>
        <small>FRH Wire &middot; Season 9 &middot; Week 4</small>
      </div>
      <div className="frh-social-strip__grid">
        {items.map((c, i) => (
          <div key={i} className={`frh-share-card frh-share-card--${c.kind.toLowerCase()}`}>
            <span className="frh-share-card__brand">&#9733; FRH</span>
            <div className="frh-share-card__title">
              <EditableField value={c.title} onEdit={isEditor ? v => onItemChange(i, { title: v }) : undefined} placeholder="Stat / quote" />
            </div>
            <div className="frh-share-card__unit">
              <EditableField value={c.unit} onEdit={isEditor ? v => onItemChange(i, { unit: v }) : undefined} placeholder="Unit label" />
            </div>
            <div className="frh-share-card__cap">
              <span>
                <EditableField value={c.caption} onEdit={isEditor ? v => onItemChange(i, { caption: v }) : undefined} placeholder="Caption" />
              </span>
              <b>SHARE &#8599;</b>
            </div>
            {isEditor && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: 10 }}>
                <select value={c.kind} onChange={e => onItemChange(i, { kind: e.target.value })}
                  style={{ background: '#111', border: '1px solid #333', color: '#ffd400', fontSize: 10 }}>
                  {['STAT','MEME','QUOTE'].map(k => <option key={k} value={k}>{k}</option>)}
                </select>
                <ItemControls isEditor={isEditor} idx={i} total={items.length}
                  onMoveUp={onMoveUp} onMoveDown={onMoveDown} onRemove={onRemove} />
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 8, textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        <Link href="/bulletin-board" style={{ color: '#ffd400', textDecoration: 'none' }}>More from the wire &rarr;</Link>
      </div>
      {isEditor && addBtn('Add social card', onAdd)}
    </div>
  );
}

export function FrhDiscordCta({ discordInviteUrl, isEditor, onUrlChange }) {
  const url = discordInviteUrl || DEFAULT_DISCORD_INVITE_URL;
  return (
    <div className="frh-discord-cta">
      <div className="frh-discord-cta__label">COMMUNITY HQ</div>
      <div className="frh-discord-cta__title">THE LEAGUE LIVES IN DISCORD</div>
      <div className="frh-discord-cta__sub">
        Draft news &middot; Fraud alerts &middot; Hot takes &middot; Match night watch parties &middot; Admin rulings
      </div>
      {isEditor ? (
        <div style={{ marginTop: 8 }}>
          <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--frh-text-muted)', display: 'block', marginBottom: 4 }}>
            DISCORD INVITE URL
          </label>
          <EditableField value={url} onEdit={onUrlChange} placeholder="https://discord.gg/…" style={{ width: '100%', maxWidth: 320 }} />
        </div>
      ) : (
        <a href={url} target="_blank" rel="noreferrer"
          className="frh-btn frh-btn--primary"
          style={{ display: 'inline-block', marginTop: 12 }}>
          &rarr; JOIN THE DISCORD
        </a>
      )}
    </div>
  );
}


// ─── Knows Ball & Washed (editor-aware inline) ────────────────────────────────

export function FrhKnowsBallPanel({ items, isEditor, onItemChange, onMoveUp, onMoveDown, onRemove, onAdd }) {
  return (
    <FrhPanel
      title="KNOWS BALL · FAKE ANALYSTS"
      accent="lime"
      kicker="WEEK 4 SLATE"
      status={["Last week: 1–3 ATS · don't bet money you wouldn't lose anyway"]}
    >
      {items.map((k, i) => (
        <div key={i} className="frh-analyst-row">
          <div className="who">
            <EditableField value={k.who} onEdit={isEditor ? v => onItemChange(i, { who: v }) : undefined} placeholder="Analyst" />
          </div>
          <div className="line">
            &ldquo;<EditableField value={k.line} onEdit={isEditor ? v => onItemChange(i, { line: v }) : undefined} placeholder="Pick line…" multiline />&rdquo;
          </div>
          <div className="conf">
            <EditableField value={k.conf} onEdit={isEditor ? v => onItemChange(i, { conf: Number(v) }) : undefined} type="number" min={0} max={100} style={{ width: 40 }} />
            <span>CONFIDENCE</span>
          </div>
          {isEditor && (
            <ItemControls isEditor={isEditor} idx={i} total={items.length}
              onMoveUp={onMoveUp} onMoveDown={onMoveDown} onRemove={onRemove} />
          )}
        </div>
      ))}
      <div style={{ marginTop: 8, textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        <Link href="/knows-ball" style={{ color: '#ffd400', textDecoration: 'none' }}>View all open lines &rarr;</Link>
      </div>
      {isEditor && addBtn('Add analyst pick', onAdd)}
    </FrhPanel>
  );
}

export function FrhWashedPanel({ items, isEditor, onItemChange, onMoveUp, onMoveDown, onRemove, onAdd }) {
  return (
    <FrhPanel
      title="WASHED REPORTS"
      accent="orange"
      kicker="ROLLING FEED"
      status={['Auto-collected · human reviewed', 'Submit a sighting →']}
    >
      <div className="frh-washed-list">
        {items.map((w, i) => (
          <div key={i} className="frh-washed-list__row">
            <span className="who">
              @<EditableField value={w.who} onEdit={isEditor ? v => onItemChange(i, { who: v }) : undefined} placeholder="IGN" style={{ width: 90 }} />
            </span>
            <span>
              <EditableField value={w.what} onEdit={isEditor ? v => onItemChange(i, { what: v }) : undefined} placeholder="What happened…" multiline />
            </span>
            <span className="time">
              <EditableField value={w.time} onEdit={isEditor ? v => onItemChange(i, { time: v }) : undefined} placeholder="12m ago" style={{ width: 70 }} />
            </span>
            {isEditor && (
              <ItemControls isEditor={isEditor} idx={i} total={items.length}
                onMoveUp={onMoveUp} onMoveDown={onMoveDown} onRemove={onRemove} />
            )}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 8, textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        <Link href="/fraud-watch" style={{ color: '#ffd400', textDecoration: 'none' }}>Read all reports &rarr;</Link>
      </div>
      {isEditor && addBtn('Add washed report', onAdd)}
    </FrhPanel>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
//
// Props:
//   All original DB-driven props (activeSeason, liveMatches, etc.) unchanged.
//
//   NEW — editorial content (from DB or defaults):
//     editableContent  {object}   Merged result of mergeWithDefaults(dbRow)
//     mode             {string}   "public" (default) | "editor"
//     onContentChange  {function} Called with (fieldName, newValue) in editor mode

export default function HomepageClient({
  // ── original DB-driven props ──────────────────────────────────────────────
  activeSeason,
  liveMatches,
  upcomingMatches,
  recentDrafts,
  divisionStandings,
  playerCount,
  godCount: _godCount,
  matchCount,
  recentResults,
  // ── new editorial props ───────────────────────────────────────────────────
  editableContent,
  mode = 'public',
  onContentChange,
}) {
  const isEditor = mode === 'editor';

  // Resolve content: use editableContent if provided, else fall back to defaults
  const content = editableContent ?? {
    ticker:           DEFAULT_TICKER,
    headlines:        DEFAULT_HEADLINES,
    bulletin:         DEFAULT_BULLETIN,
    fraudWatch:       DEFAULT_FRAUD_WATCH,
    motw:             DEFAULT_MOTW,
    rivalries:        DEFAULT_RIVALRIES,
    knowsBall:        DEFAULT_KNOWS_BALL,
    washedReports:    DEFAULT_WASHED_REPORTS,
    socialCards:      DEFAULT_SOCIAL_CARDS,
    discordInviteUrl: DEFAULT_DISCORD_INVITE_URL,
    washedPct:        DEFAULT_WASHED_PCT,
    showTicker:        true,
    showHeadlines:     true,
    showBulletin:      true,
    showFraudWatch:    true,
    showMotw:          true,
    showRivalries:     true,
    showKnowsBall:     true,
    showWashedReports: true,
    showSocialCards:   true,
  };

  // Shorthand: call onContentChange with a specific top-level field
  const change = isEditor ? (field, value) => onContentChange?.(field, value) : null;

  // List mutation helpers bound to specific content fields
  const listHandlers = (field, defaultItem) => isEditor ? {
    isEditor,
    onItemChange: (i, patch) => change(field, updateAt(content[field], i, patch)),
    onMoveUp:     (i)        => change(field, moveUp(content[field], i)),
    onMoveDown:   (i)        => change(field, moveDown(content[field], i)),
    onRemove:     (i)        => change(field, removeAt(content[field], i)),
    onAdd:        ()         => change(field, [...content[field], { ...defaultItem }]),
  } : { isEditor: false };

  const hasLive   = liveMatches?.length > 0;
  const liveMatch = liveMatches?.[0] ?? null;
  const nextMatch = upcomingMatches?.[0] ?? null;
  const hasDrafts = recentDrafts?.length > 0;

  const rankingsRows = (() => {
    if (divisionStandings?.length > 0) {
      const allRows = divisionStandings.flatMap(({ rows }) => rows);
      if (allRows.length >= 1) {
        return allRows.slice(0, 10).map((row, i) => ({
          rank: i + 1,
          team: row.teamName,
          tag:  row.teamTag,
          trend: 0,
          blurb: 'Season record speaks for itself.',
          record: `${row.wins}–${row.losses}`,
          color: '#444',
        }));
      }
    }
    return RANKINGS_DATA;
  })();

  // ── Section visibility wrapper ────────────────────────────────────────────
  // In editor mode, hidden sections still render but are visually dimmed.
  // In public mode, hidden sections are not rendered at all.
  function Section({ field, children }) {
    const visible = content[`show${field}`] ?? true;
    if (!isEditor && !visible) return null;
    return (
      <div style={isEditor && !visible ? { opacity: 0.35, pointerEvents: 'none', position: 'relative' } : undefined}>
        {isEditor && (
          <button
            onClick={() => change(`show${field}`, !visible)}
            style={{
              position: 'absolute', top: 4, right: 4, zIndex: 10,
              pointerEvents: 'auto',
              background: visible ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)',
              border: `1px solid ${visible ? '#4ade80' : '#f87171'}`,
              color: visible ? '#4ade80' : '#f87171',
              fontSize: 10, padding: '2px 8px', cursor: 'pointer', fontFamily: 'var(--font-mono)',
              borderRadius: 2,
            }}
          >
            {visible ? '👁 VISIBLE' : '🚫 HIDDEN'}
          </button>
        )}
        {children}
      </div>
    );
  }

  return (
    <>
      {content.showTicker || isEditor ? (
        <Section field="Ticker">
          <FrhTicker
            items={content.ticker}
            {...listHandlers('ticker', { tag: 'NEWS', text: 'New ticker item', tone: 'info' })}
          />
        </Section>
      ) : null}

      <FrhMasthead
        activeSeason={activeSeason}
        playerCount={playerCount}
        matchCount={matchCount ?? 0}
        washedPct={content.washedPct}
        isEditor={isEditor}
        onWashedPctChange={isEditor ? v => change('washedPct', v) : undefined}
      />

      <div className="frh-editorial-shell">

        {/* ── Section 1: Broadcast Hero ─────────────────────── */}
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
            <FrhPanel title="DRAFT ROOMS OPEN" accent="lime" status={['Real-time · join before picks lock']}>
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

        {/* ── Recent Results (data-driven) ─────────────────── */}
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

        {/* ── Section 2: The Wire ─────────────────────────── */}
        <Section field="Headlines">
          <FrhSectionLabel kind="prime" pill="FRH WIRE" title="ROTATING HEADLINES" after="UPDATED 3H AGO" />
          <div className="frh-wire-grid">
            <FrhLeadStory
              h={content.headlines[0] ?? DEFAULT_HEADLINES[0]}
              isEditor={isEditor}
              onChange={isEditor ? patch => change('headlines', updateAt(content.headlines, 0, patch)) : undefined}
            />
            <FrhSidebarStories
              items={content.headlines.slice(1)}
              {...(isEditor ? {
                isEditor,
                onItemChange: (i, patch) => change('headlines', updateAt(content.headlines, i + 1, patch)),
                onMoveUp:     (i)        => change('headlines', moveUp(content.headlines, i + 1)),
                onMoveDown:   (i)        => change('headlines', moveDown(content.headlines, i + 1)),
                onRemove:     (i)        => change('headlines', removeAt(content.headlines, i + 1)),
                onAdd:        ()         => change('headlines', [...content.headlines, { kicker: 'NEWS', title: 'New story', blurb: '', byline: 'Staff', time: 'just now' }]),
              } : { isEditor: false })}
            />
          </div>
        </Section>

        {/* ── Section 3: Power Rankings ──────────────────── */}
        <FrhSectionLabel kind="alert" pill="RANKINGS" title="NURSING HOME POWER RANKINGS" after="WEEK 4" />
        <FrhPanel title="NURSING HOME POWER RANKINGS" accent="orange" kicker="WEEK 4"
          status={['Composite of FrankBot + community + vibes', 'Δ vs last week']}>
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
                {r.trend > 0 ? `▲${r.trend}` : r.trend < 0 ? `▼${Math.abs(r.trend)}` : '—'}
              </div>
            </div>
          ))}
        </FrhPanel>

        {/* ── Form Check: Hot/Cold Teams (computed) ──────── */}
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

        {/* ── Section 4: Bulletin Board + Fraud Watch ───── */}
        <Section field="Bulletin">
          <FrhSectionLabel kind="comm" pill="COMMUNITY" title="BULLETIN BOARD + FRAUD WATCH" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 4 }}>
            <FrhBulletinForum
              items={content.bulletin}
              {...listHandlers('bulletin', { tag: 'PSA', user: 'Admin', title: 'New post', replies: 0, hot: false })}
            />
            <Section field="FraudWatch">
              <FrhFraudWanted
                items={content.fraudWatch}
                {...listHandlers('fraudWatch', { player: 'Player', team: 'TAG', charge: 'Charge description', level: 1 })}
              />
            </Section>
          </div>
        </Section>

        {/* ── Section 5: Match of the Week ──────────────── */}
        <Section field="Motw">
          <FrhSectionLabel kind="prime" pill="★ MOTW" title="MATCH OF THE WEEK" after="FRI NIGHT · PRIMETIME" />
          <FrhMotwMega
            motw={content.motw}
            isEditor={isEditor}
            onChange={isEditor ? patch => change('motw', { ...content.motw, ...patch }) : undefined}
          />
        </Section>

        {/* ── Section 6: Rivalry Systems ────────────────── */}
        <Section field="Rivalries">
          <FrhSectionLabel kind="comm" pill="FEUDS" title="RIVALRY SYSTEMS" after={`${content.rivalries.length} ACTIVE`} />
          <FrhRivalryPosters
            items={content.rivalries}
            {...listHandlers('rivalries', { title: 'New Rivalry', teams: ['Team A', 'Team B'], tags: ['AAA','BBB'], colors: ['#CC3300','#2B5BA8'], record: '0 — 0', note: 'Rivalry notes…' })}
          />
        </Section>

        {/* ── Section 7: Knows Ball + Washed Reports ──────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 4 }}>
          <Section field="KnowsBall">
            <FrhKnowsBallPanel
              items={content.knowsBall}
              {...listHandlers('knowsBall', { who: 'Analyst', line: 'Pick line here', conf: 50 })}
            />
          </Section>
          <Section field="WashedReports">
            <FrhWashedPanel
              items={content.washedReports}
              {...listHandlers('washedReports', { who: 'Player', what: 'Did something washed', time: 'just now' })}
            />
          </Section>
        </div>

        {/* ── Section 8: Social Strip ───────────────────── */}
        <Section field="SocialCards">
          <FrhSocialStrip
            items={content.socialCards}
            {...listHandlers('socialCards', { kind: 'STAT', title: '0', unit: 'unit label', caption: 'caption text' })}
          />
        </Section>

        {/* ── Section 9: Upcoming Slate + Standings ──────── */}
        <FrhSectionLabel kind="default" pill="SCHEDULE" title="THIS WEEK'S SLATE + STANDINGS" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 4 }}>
          <FrhPanel title="THIS WEEK'S SLATE" accent="blue" status={['Full schedule at /schedule']}>
            {upcomingMatches?.length > 0 ? (
              <div className="frh-slate">
                {upcomingMatches.map((m) => {
                  const dt = m.scheduledAt ? new Date(m.scheduledAt) : null;
                  const homeLogo = getTeamLogo(m.homeTeam);
                  const awayLogo = getTeamLogo(m.awayTeam);
                  return (
                    <div key={m.id} className="frh-slate__row">
                      <div className="frh-slate__when">
                        {dt ? dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'TBD'}
                        {dt && <span>{dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>}
                      </div>
                      <div className="frh-slate__team">
                        <div className="frh-slate__mini-crest" style={{ background: m.homeTeam?.accentColor ?? '#444' }}>
                          {homeLogo ? <Image src={homeLogo} alt={`${m.homeTeam?.name ?? 'Home team'} logo`} width={22} height={22} /> : (m.homeTeam?.tag ?? '?')}
                        </div>
                        {m.homeTeam?.name ?? 'TBD'}
                      </div>
                      <div className="frh-slate__vs">vs</div>
                      <div className="frh-slate__team right">
                        {m.awayTeam?.name ?? 'TBD'}
                        <div className="frh-slate__mini-crest" style={{ background: m.awayTeam?.accentColor ?? '#444' }}>
                          {awayLogo ? <Image src={awayLogo} alt={`${m.awayTeam?.name ?? 'Away team'} logo`} width={22} height={22} /> : (m.awayTeam?.tag ?? '?')}
                        </div>
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

        {/* ── Section 10: Discord CTA ───────────────────── */}
        <FrhDiscordCta
          discordInviteUrl={content.discordInviteUrl}
          isEditor={isEditor}
          onUrlChange={isEditor ? v => change('discordInviteUrl', v) : undefined}
        />

      </div>
    </>
  );
}
