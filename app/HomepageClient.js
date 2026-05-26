'use client';

import Link from 'next/link';
import { BrutalButton, StatusBadge } from '@/components/ui';

// ─── Editorial placeholder data ────────────────────────────────────────────

const TICKER_DATA = [
  { tag: 'FINAL',    text: 'BEDPAN BANDITS 2 — MALL WALKERS 0',                              tone: 'score' },
  { tag: 'BREAKING', text: 'BrokenHipBruiser benched 1 week after going 0/14 in promo',      tone: 'alert' },
  { tag: 'FRAUD',    text: 'Centurions caught buying 14 sentry wards in 4 minutes',           tone: 'alert' },
  { tag: 'POLL',     text: '73% of analysts believe the jungle is washed',                    tone: 'info'  },
  { tag: 'FINAL',    text: 'LATE STAGE TYRANTS 2 — PILLBOX PHOENIXES 1',                     tone: 'score' },
  { tag: 'WASHED',   text: "ShuffleboardSusano admits he hasn't bought boots since Season 6", tone: 'alert' },
  { tag: 'TRADE',    text: 'Last Will & Tower acquires support DenturesOnLockdown',           tone: 'info'  },
  { tag: 'PICK',     text: 'Knows Ball: favorites cover −3.5. Lock it.',                 tone: 'info'  },
];

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

const BULLETIN_DATA = [
  { tag: 'LFM',   user: 'DenturesOnLockdown', title: 'LFM scrim Thu 9pm EST — must own a controller AND a chair', replies: 14, hot: true  },
  { tag: 'META',  user: 'xX_GrandpasGank_Xx', title: 'Is jungle Hercules actually good or am I cooked',               replies: 47, hot: true  },
  { tag: 'SALT',  user: 'WashedOutWanda',      title: 'i refuse to believe Jormungandr is a real god',                 replies: 88, hot: true  },
  { tag: 'CLIP',  user: 'PillboxPhil',         title: 'watch me steal fire giant w/ 2 hp and a prayer',               replies: 22, hot: false },
  { tag: 'TRADE', user: 'MidnightMidlaner',    title: 'my Loki main for your support who actually wards',             replies:  9, hot: false },
  { tag: 'PSA',   user: 'Admin Gremlin',       title: 'Stop drafting Cabrakan in solo lane. We\'re begging.',         replies:  3, hot: false },
  { tag: 'LFT',   user: 'ShuffleboardSusano',  title: 'Free agent. I show up. Sometimes sober.',                      replies: 17, hot: false },
];

const FRAUD_DATA = [
  { player: 'BrokenHipBruiser',   team: 'MALL', charge: '0/12/3 in a promo. Posted "gg ez" anyway.',           level: 3 },
  { player: 'xX_GrandpasGank_Xx', team: 'BEDP', charge: 'Claims 1500 MMR. Suspected 700. Investigating.',      level: 2 },
  { player: 'ShuffleboardSusano', team: 'PILL', charge: 'Has not purchased boots in any match since Season 6.', level: 3 },
  { player: 'MidnightMidlaner',   team: 'WHIS', charge: 'Three-game streak of "mouse died" alibis.',           level: 1 },
];

const HEADLINES_DATA = [
  { kicker: 'ANALYSIS',  title: 'The Bedpan Doctrine: how a mid-Anubis pick became the most-feared comp in FRH', blurb: 'Three weeks ago nobody respected it. Now coaches are banning Anubis on sight and the Bandits are 5–0.', byline: 'Cane Courier',  time: '3h ago'    },
  { kicker: 'FILM ROOM', title: 'Watch: GrandpasGank solos baron with one boot and zero awareness',              blurb: 'We slowed the clip down to 0.25x. It only made it worse.',                                               byline: 'FRH Film Room', time: '6h ago'    },
  { kicker: 'OPINION',   title: "It's time to admit the Mall Walkers' jungle is washed",                         blurb: 'Four matches. Three negative KDAs. One excuse about a "new mouse." The math is the math.',               byline: 'Admin Gremlin', time: 'yesterday' },
];

const MOTW_DATA = {
  title: 'BEDPAN BANDITS vs LATE STAGE TYRANTS',
  when: 'FRI · 9:00 PM EST',
  storyline: 'Both teams have not lost in division play since Week 1. Bandits ride a 5-game streak. Tyrants haven’t dropped a series since Season 8 finals. Someone’s streak ends Friday.',
  h2h: [
    { season: 'S8', result: 'TYRN 2–1 BEDP' },
    { season: 'S8', result: 'BEDP 2–0 TYRN' },
    { season: 'S9', result: 'BEDP 2–1 TYRN' },
  ],
  stakes: 'Loser drops to #3 in Power Rankings. Winner gets a Cane Courier feature article.',
};

const RIVALRY_DATA = [
  { title: 'The Hallway War',    teams: ['Mall Walkers', 'Centennial Centurions'], tags: ['MALL','CENT'], colors: ['#6f35ff','#5C6B2E'], record: 'MALL 4 — CENT 5 (lifetime)', note: 'Started Season 3 over a draft trade. Still unresolved. Voice-chat banned in this matchup.' },
  { title: 'Bedpan vs The World',teams: ['Bedpan Bandits', 'Field'],               tags: ['BEDP','FRH'],  colors: ['#CC3300','#111111'], record: 'BEDP 11 — Field 3 (S9)',      note: 'Every team in the league has now lost to the Bandits at least once. Discord has thoughts.' },
  { title: 'Old Friends Cup',    teams: ['Whiskey Wardens','Sundown Saboteurs'],    tags: ['WHIS','SUND'], colors: ['#8a4a13','#2B5BA8'], record: 'WHIS 6 — SUND 6',            note: "Captains used to duo queue. Now they don't speak. Trophy is a thrift-store mug." },
];

const KNOWS_BALL_DATA = [
  { who: 'FrankBot',        line: 'Bedpan Bandits cover the -4.5. Lock it.',                              conf: 92 },
  { who: 'Cane Courier',    line: 'Tyrants vs Phoenixes goes UNDER 28 minutes. Phoenixes fold at draft.', conf: 71 },
  { who: 'Admin Gremlin',   line: 'Whiskey Wardens win Game 3 but somebody quits voice chat.',            conf: 64 },
  { who: 'FraudWatch-9000', line: 'Centurions caught buying sentries again. Statistically inevitable.',   conf: 88 },
];

const WASHED_DATA = [
  { who: 'GrandpasGank',       what: 'Auto-attacked the wrong jungle camp. Twice.',          time: '12m ago'   },
  { who: 'DenturesOnLockdown', what: 'Bought 3 starter items at minute 19.',                 time: '1h ago'    },
  { who: 'WashedOutWanda',     what: 'Pinged her own base as "enemy missing."',              time: '2h ago'    },
  { who: 'PillboxPhil',        what: 'Surrendered a won game by accident.',                  time: '3h ago'    },
  { who: 'ShuffleboardSusano', what: 'Logged off mid-draft. Came back as a different god.',  time: 'yesterday' },
];

const SOCIAL_CARD_DATA = [
  { kind: 'STAT',  title: '0',                        unit: 'boots purchased by Susano',     caption: 'since Season 6'                    },
  { kind: 'STAT',  title: '73%',                      unit: "win-rate of Bandits' Anubis",   caption: 'across 11 matches'                 },
  { kind: 'MEME',  title: '"gg ez"',                  unit: 'after a 0/12 loss',             caption: '— BrokenHipBruiser, 2026'      },
  { kind: 'QUOTE', title: '"I just queue and hope."', unit: 'captain, Pillbox Phoenixes',    caption: 'league sit-down, ep. 4'            },
  { kind: 'STAT',  title: '14',                       unit: 'wards purchased illegally',     caption: 'by Centurions, 4 min mark'         },
  { kind: 'MEME',  title: 'WASHED',                   unit: 'official league designation',   caption: 'applies to 4 of 7 current rosters' },
];

// ─── Sub-components ──────────────────────────────────────────────────────────

function FrhTicker({ items }) {
  const loop = [...items, ...items];
  return (
    <div className="frh-ticker">
      <div className="frh-ticker__label">
        FRH<span style={{ fontSize: 11, letterSpacing: '0.18em', marginLeft: 8 }}>WIRE</span>
      </div>
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
    </div>
  );
}

function FrhMasthead({ activeSeason, playerCount, matchCount }) {
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
          <div className="frh-statchip__num">88</div>
          <div className="frh-statchip__lbl">Washed%</div>
        </div>
      </div>
    </header>
  );
}

function FrhSectionLabel({ kind = 'default', pill, title, after }) {
  return (
    <div className={`frh-section-label frh-section-label--${kind}`}>
      <span className="frh-section-label__pill">{pill}</span>
      <span className="frh-section-label__title">{title}</span>
      {after && <span className="frh-section-label__after">{after}</span>}
    </div>
  );
}

function FrhPanel({ title, accent = 'yellow', kicker, status, children }) {
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

function FrhMegaScoreboard({ liveMatch, upcomingMatch }) {
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
            <div className="frh-mega__crest">{m.homeTeam?.tag ?? '—'}</div>
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
            <div className="frh-mega__crest">{m.awayTeam?.tag ?? '—'}</div>
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
    const dateStr = dt
      ? dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      : 'TBD';
    const timeStr = dt
      ? dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      : '';
    return (
      <div className="frh-mega">
        <div className="frh-mega__topbar frh-mega__topbar--upcoming">
          UPCOMING &middot; {m.division?.name ?? 'FRH Pro Division'}
          <span className="right">{dateStr}{timeStr ? ` · ${timeStr}` : ''}</span>
        </div>
        <div className="frh-mega__teams">
          <div className="frh-mega__side" style={{ background: homeColor }}>
            <div className="frh-mega__crest">{m.homeTeam?.tag ?? '—'}</div>
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
            <div className="frh-mega__crest">{m.awayTeam?.tag ?? '—'}</div>
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
        <p style={{ margin: '0 0 10px' }}>
          <b>FRH_BROADCAST</b> has encountered a <b>washed event</b> and needs to close.
        </p>
        <p style={{ margin: '0 0 6px', opacity: 0.7 }}>
          No live matches. Everyone is probably arguing in Discord.
        </p>
        <p style={{ margin: '0', opacity: 0.5, fontSize: 11 }}>
          *** STOP: 0xWASHED_OUT_DEEP (BEDPAN_BANDITS, 0x00000005, 0xFEEDC0DE)
        </p>
      </div>
      <div className="frh-mega__lowerthird">
        <span><b>STATUS:</b> Off-season / no matches scheduled</span>
        <Link href="/schedule" style={{ marginLeft: 'auto', color: '#ffd400' }}>Check schedule &rarr;</Link>
      </div>
    </div>
  );
}

function FrhCrtPanel({ isLive, liveMatch }) {
  return (
    <div className={`frh-crt${isLive ? '' : ' frh-crt--offline'}`}>
      <div className="frh-crt__bezel">
        {isLive && liveMatch ? (
          <div className="frh-live-feed">
            <div className="frh-live-feed__hero">
              &ldquo;{liveMatch.homeTeam?.name ?? 'HOME'}<br />vs<br />{liveMatch.awayTeam?.name ?? 'AWAY'}&rdquo;
            </div>
            <div className="frh-live-feed__lower">
              <div>
                <span>NOW BROADCASTING</span>
                FRH Match Night
              </div>
              <div style={{ textAlign: 'right' }}>
                <span>STATUS</span>
                &#9679; LIVE
              </div>
            </div>
          </div>
        ) : (
          <div className="frh-bsod">
            <div className="face">:(</div>
            <p>
              FRH&nbsp;BROADCAST has encountered an unhandled <b>washed event</b> and needs to
              close. If you were watching a match, the match has been resolved in favor of
              whichever team had snacks.
            </p>
            <p>
              If this is the first time you&apos;ve seen this stop, restart your{' '}
              <span className="code">controller</span>, your{' '}
              <span className="code">marriage</span>, and your{' '}
              <span className="code">browser</span>.
            </p>
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

function FrhLeadStory({ h }) {
  return (
    <article className="frh-lead-story">
      <div className="frh-lead-story__art">
        <span className="frh-lead-story__kicker">{h.kicker}</span>
        <span className="frh-lead-story__placeholder">hero image</span>
      </div>
      <div className="frh-lead-story__body">
        <h2 className="frh-lead-story__title">{h.title}</h2>
        <p className="frh-lead-story__blurb">{h.blurb}</p>
        <div className="frh-lead-story__byline">
          BY <b>{h.byline}</b> &middot; {h.time} &middot; 8 MIN READ
        </div>
      </div>
    </article>
  );
}

function FrhSidebarStories({ items }) {
  return (
    <div className="frh-sidebar-stories">
      {items.map((h, i) => (
        <article key={i} className="frh-sidebar-story">
          <span className="frh-sidebar-story__num">{(i + 2).toString().padStart(2, '0')}</span>
          <div>
            <span className="frh-sidebar-story__kicker">{h.kicker}</span>
            <h3 className="frh-sidebar-story__title">{h.title}</h3>
            <div className="frh-sidebar-story__byline">BY {h.byline} &middot; {h.time}</div>
          </div>
        </article>
      ))}
    </div>
  );
}

function FrhBulletinForum({ items }) {
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
        <span>TAG</span>
        <span>THREAD</span>
        <span>REPLIES</span>
        <span>HOT</span>
      </div>
      {rows.map((b, i) => (
        <div key={i} className={`frh-forum__post${b.sticky ? ' frh-forum__post--sticky' : ''}`}>
          <span className={`frh-forum__tag frh-forum__tag--${b.tag}`}>{b.tag}</span>
          <span className="frh-forum__title">
            <b>{b.title}</b>
            <span className="frh-forum__author">@{b.user} &middot; 2h ago</span>
          </span>
          <span className="frh-forum__replies">{b.replies}<span>replies</span></span>
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {b.hot
              ? <span className="frh-forum__hot">&#9733; HOT</span>
              : <span style={{ color: 'var(--frh-text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>&mdash;</span>}
          </span>
        </div>
      ))}
      <div className="frh-forum__foot">
        <span>&#8593; STICKY</span>
        <span style={{ marginLeft: 'auto' }}>VIEW ALL THREADS &rarr;</span>
      </div>
    </div>
  );
}

function FrhFraudWanted({ items }) {
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
              <span className="frh-wanted-card__case">
                CASE #{(i + 1).toString().padStart(3, '0')}
              </span>
            </div>
            <h4 className="frh-wanted-card__player">{c.player}</h4>
            <div className="frh-wanted-card__team">TEAM {c.team}</div>
            <p className="frh-wanted-card__charge">&ldquo;{c.charge}&rdquo;</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function FrhMotwMega({ motw }) {
  return (
    <div className="frh-motw-mega">
      <div className="frh-motw-mega__poster">
        <span className="frh-motw-mega__kicker">FRI NIGHT &middot; PRIMETIME &middot; 9:00 PM EST</span>
        <div>
          <h2 className="frh-motw-mega__matchup">{motw.title}</h2>
          <div className="frh-motw-mega__when">{motw.when}</div>
          <p className="frh-motw-mega__story">{motw.storyline}</p>
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
            {motw.h2h.map((h, i) => (
              <li key={i}><span>{h.season}</span><span>{h.result}</span></li>
            ))}
          </ul>
        </div>
        <div>
          <div className="frh-motw-mega__sectionhead">STAKES</div>
          <div className="frh-motw-mega__stakes">
            <b>WHAT&apos;S ON THE LINE</b>
            {motw.stakes}
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

function FrhRivalryPosters({ items }) {
  return (
    <div className="frh-rivalry-row">
      {items.map((r, i) => (
        <div key={i} className="frh-poster">
          <div className="frh-poster__matchup">
            <div className="frh-poster__side" style={{ background: r.colors[0] }}>
              <div className="frh-poster__crest">{r.tags[0]}</div>
              <div>{r.teams[0]}</div>
            </div>
            <div className="frh-poster__vs">VS</div>
            <div className="frh-poster__side right" style={{ background: r.colors[1] }}>
              <div className="frh-poster__crest">{r.tags[1]}</div>
              <div>{r.teams[1]}</div>
            </div>
          </div>
          <div className="frh-poster__title">{r.title}</div>
          <div className="frh-poster__note">
            {r.note}
            <div className="frh-poster__rec">
              <b>ALL-TIME</b>
              <span>{r.record}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function FrhSocialStrip({ items }) {
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
            <div className="frh-share-card__title">{c.title}</div>
            <div className="frh-share-card__unit">{c.unit}</div>
            <div className="frh-share-card__cap">
              <span>{c.caption}</span>
              <b>SHARE &#8599;</b>
            </div>
          </div>
        ))}
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
      <a
        href="https://discord.gg/HPAZmHmBpD"
        target="_blank"
        rel="noreferrer"
        className="frh-btn frh-btn--primary"
        style={{ display: 'inline-block', marginTop: 12 }}
      >
        &rarr; JOIN THE DISCORD
      </a>
    </div>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

export default function HomepageClient({
  activeSeason,
  liveMatches,
  upcomingMatches,
  recentDrafts,
  divisionStandings,
  playerCount,
  godCount: _godCount,
  matchCount,
  recentResults: _recentResults,
}) {
  const hasLive   = liveMatches?.length > 0;
  const liveMatch = liveMatches?.[0] ?? null;
  const nextMatch = upcomingMatches?.[0] ?? null;
  const hasDrafts = recentDrafts?.length > 0;

  const rankingsRows = (() => {
    if (divisionStandings?.length > 0) {
      const allRows = divisionStandings.flatMap(({ rows }) => rows);
      if (allRows.length >= 3) {
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

  return (
    <>
      <FrhTicker items={TICKER_DATA} />
      <FrhMasthead activeSeason={activeSeason} playerCount={playerCount} matchCount={matchCount ?? 0} />

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

        {/* ── Section 2: The Wire ───────────────────────────── */}
        <FrhSectionLabel kind="prime" pill="FRH WIRE" title="ROTATING HEADLINES" after="UPDATED 3H AGO" />
        <div className="frh-wire-grid">
          <FrhLeadStory h={HEADLINES_DATA[0]} />
          <FrhSidebarStories items={HEADLINES_DATA.slice(1)} />
        </div>

        {/* ── Section 3: Power Rankings ─────────────────────── */}
        <FrhSectionLabel kind="alert" pill="RANKINGS" title="NURSING HOME POWER RANKINGS" after="WEEK 4" />
        <FrhPanel
          title="NURSING HOME POWER RANKINGS"
          accent="orange"
          kicker="WEEK 4"
          status={['Composite of FrankBot + community + vibes', 'Δ vs last week']}
        >
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

        {/* ── Section 4: Bulletin Board + Fraud Watch ──────── */}
        <FrhSectionLabel kind="comm" pill="COMMUNITY" title="BULLETIN BOARD + FRAUD WATCH" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 4 }}>
          <FrhBulletinForum items={BULLETIN_DATA} />
          <FrhFraudWanted items={FRAUD_DATA} />
        </div>

        {/* ── Section 5: Match of the Week ─────────────────── */}
        <FrhSectionLabel kind="prime" pill="★ MOTW" title="MATCH OF THE WEEK" after="FRI NIGHT · PRIMETIME" />
        <FrhMotwMega motw={MOTW_DATA} />

        {/* ── Section 6: Rivalry Systems ───────────────────── */}
        <FrhSectionLabel kind="comm" pill="FEUDS" title="RIVALRY SYSTEMS" after="3 ACTIVE" />
        <FrhRivalryPosters items={RIVALRY_DATA} />

        {/* ── Section 7: Knows Ball + Washed Reports ───────── */}
        <FrhSectionLabel kind="default" pill="ANALYSIS" title="KNOWS BALL + WASHED REPORTS" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 4 }}>
          <FrhPanel
            title="KNOWS BALL · FAKE ANALYSTS"
            accent="lime"
            kicker="WEEK 4 SLATE"
            status={["Last week: 1–3 ATS · don't bet money you wouldn't lose anyway"]}
          >
            {KNOWS_BALL_DATA.map((k, i) => (
              <div key={i} className="frh-analyst-row">
                <div className="who">{k.who}</div>
                <div className="line">&ldquo;{k.line}&rdquo;</div>
                <div className="conf">{k.conf}<span>CONFIDENCE</span></div>
              </div>
            ))}
          </FrhPanel>

          <FrhPanel
            title="WASHED REPORTS"
            accent="orange"
            kicker="ROLLING FEED"
            status={['Auto-collected · human reviewed', 'Submit a sighting →']}
          >
            <div className="frh-washed-list">
              {WASHED_DATA.map((w, i) => (
                <div key={i} className="frh-washed-list__row">
                  <span className="who">@{w.who}</span>
                  <span>{w.what}</span>
                  <span className="time">{w.time}</span>
                </div>
              ))}
            </div>
          </FrhPanel>
        </div>

        {/* ── Section 8: Social Strip ───────────────────────── */}
        <FrhSocialStrip items={SOCIAL_CARD_DATA} />

        {/* ── Section 9: Upcoming Slate + Standings ────────── */}
        <FrhSectionLabel kind="default" pill="SCHEDULE" title="THIS WEEK'S SLATE + STANDINGS" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 4 }}>

          <FrhPanel title="THIS WEEK'S SLATE" accent="blue" status={['Full schedule at /schedule']}>
            {upcomingMatches?.length > 0 ? (
              <div className="frh-slate">
                {upcomingMatches.map((m) => {
                  const dt = m.scheduledAt ? new Date(m.scheduledAt) : null;
                  return (
                    <div key={m.id} className="frh-slate__row">
                      <div className="frh-slate__when">
                        {dt
                          ? dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                          : 'TBD'}
                        {dt && (
                          <span>{dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                        )}
                      </div>
                      <div className="frh-slate__team">
                        <div className="frh-slate__mini-crest" style={{ background: m.homeTeam?.accentColor ?? '#444' }}>
                          {m.homeTeam?.tag ?? '?'}
                        </div>
                        {m.homeTeam?.name ?? 'TBD'}
                      </div>
                      <div className="frh-slate__vs">vs</div>
                      <div className="frh-slate__team right">
                        {m.awayTeam?.name ?? 'TBD'}
                        <div className="frh-slate__mini-crest" style={{ background: m.awayTeam?.accentColor ?? '#444' }}>
                          {m.awayTeam?.tag ?? '?'}
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
                <FrhPanel
                  key={division.id}
                  title={`${division.name.toUpperCase()} STANDINGS`}
                  accent="yellow"
                  status={[`Top ${Math.min(rows.length, 5)} shown`]}
                >
                  {rows.length === 0 ? (
                    <div style={{ padding: '16px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, opacity: 0.6 }}>
                      No completed matches yet.
                    </div>
                  ) : (
                    rows.slice(0, 5).map((row, i) => (
                      <div key={row.teamId} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '7px 12px', borderBottom: '1px solid var(--frh-border)',
                        background: i === 0 ? 'rgba(255,212,0,0.06)' : undefined,
                      }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, width: 18, color: i === 0 ? '#CC3300' : 'var(--frh-text-muted)' }}>
                          {i + 1}
                        </span>
                        <Link href={`/teams/${row.teamId}`} style={{ flex: 1, minWidth: 0, textDecoration: 'none' }}>
                          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, color: 'var(--frh-text)' }}>
                            {row.teamName}
                          </span>
                          <span style={{ marginLeft: 6, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--frh-text-muted)' }}>
                            [{row.teamTag}]
                          </span>
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

        {/* ── Section 10: Discord CTA ───────────────────────── */}
        <FrhDiscordCta />

      </div>
    </>
  );
}
