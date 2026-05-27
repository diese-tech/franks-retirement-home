// ─── Homepage Editorial Defaults ─────────────────────────────────────────────
//
// These are the canonical fallback values for all editable homepage sections.
// The public page uses these when no "published" HomepageContent row exists in DB.
// The admin editor pre-fills these when no draft exists.
// Reset to Default deletes the DB draft and falls back here.
//
// Shape of each array item / object is the ground truth for the JSON columns
// in the HomepageContent Prisma model.

export const DEFAULT_TICKER = [
  { tag: 'FINAL',    text: 'BEDPAN BANDITS 2 — MALL WALKERS 0',                              tone: 'score' },
  { tag: 'BREAKING', text: 'BrokenHipBruiser benched 1 week after going 0/14 in promo',      tone: 'alert' },
  { tag: 'FRAUD',    text: 'Centurions caught buying 14 sentry wards in 4 minutes',           tone: 'alert' },
  { tag: 'POLL',     text: '73% of analysts believe the jungle is washed',                    tone: 'info'  },
  { tag: 'FINAL',    text: 'LATE STAGE TYRANTS 2 — PILLBOX PHOENIXES 1',                     tone: 'score' },
  { tag: 'WASHED',   text: "ShuffleboardSusano admits he hasn't bought boots since Season 6", tone: 'alert' },
  { tag: 'TRADE',    text: 'Last Will & Tower acquires support DenturesOnLockdown',           tone: 'info'  },
  { tag: 'PICK',     text: 'Knows Ball: favorites cover −3.5. Lock it.',                      tone: 'info'  },
];

export const DEFAULT_HEADLINES = [
  { kicker: 'ANALYSIS',  title: 'The Bedpan Doctrine: how a mid-Anubis pick became the most-feared comp in FRH', blurb: 'Three weeks ago nobody respected it. Now coaches are banning Anubis on sight and the Bandits are 5–0.', byline: 'Cane Courier',  time: '3h ago'    },
  { kicker: 'FILM ROOM', title: 'Watch: GrandpasGank solos baron with one boot and zero awareness',              blurb: 'We slowed the clip down to 0.25x. It only made it worse.',                                               byline: 'FRH Film Room', time: '6h ago'    },
  { kicker: 'OPINION',   title: "It's time to admit the Mall Walkers' jungle is washed",                         blurb: 'Four matches. Three negative KDAs. One excuse about a "new mouse." The math is the math.',               byline: 'Admin Gremlin', time: 'yesterday' },
];

export const DEFAULT_BULLETIN = [
  { tag: 'LFM',   user: 'DenturesOnLockdown', title: 'LFM scrim Thu 9pm EST — must own a controller AND a chair', replies: 14, hot: true  },
  { tag: 'META',  user: 'xX_GrandpasGank_Xx', title: 'Is jungle Hercules actually good or am I cooked',               replies: 47, hot: true  },
  { tag: 'SALT',  user: 'WashedOutWanda',      title: 'i refuse to believe Jormungandr is a real god',                 replies: 88, hot: true  },
  { tag: 'CLIP',  user: 'PillboxPhil',         title: 'watch me steal fire giant w/ 2 hp and a prayer',               replies: 22, hot: false },
  { tag: 'TRADE', user: 'MidnightMidlaner',    title: 'my Loki main for your support who actually wards',             replies:  9, hot: false },
  { tag: 'PSA',   user: 'Admin Gremlin',       title: "Stop drafting Cabrakan in solo lane. We're begging.",          replies:  3, hot: false },
  { tag: 'LFT',   user: 'ShuffleboardSusano',  title: 'Free agent. I show up. Sometimes sober.',                      replies: 17, hot: false },
];

export const DEFAULT_FRAUD_WATCH = [
  { player: 'BrokenHipBruiser',   team: 'MALL', charge: '0/12/3 in a promo. Posted "gg ez" anyway.',           level: 3 },
  { player: 'xX_GrandpasGank_Xx', team: 'BEDP', charge: 'Claims 1500 MMR. Suspected 700. Investigating.',      level: 2 },
  { player: 'ShuffleboardSusano', team: 'PILL', charge: 'Has not purchased boots in any match since Season 6.', level: 3 },
  { player: 'MidnightMidlaner',   team: 'WHIS', charge: 'Three-game streak of "mouse died" alibis.',           level: 1 },
];

export const DEFAULT_MOTW = {
  title: 'BEDPAN BANDITS vs LATE STAGE TYRANTS',
  when: 'FRI · 9:00 PM EST',
  storyline: 'Both teams have not lost in division play since Week 1. Bandits ride a 5-game streak. Tyrants haven\'t dropped a series since Season 8 finals. Someone\'s streak ends Friday.',
  h2h: [
    { season: 'S8', result: 'TYRN 2–1 BEDP' },
    { season: 'S8', result: 'BEDP 2–0 TYRN' },
    { season: 'S9', result: 'BEDP 2–1 TYRN' },
  ],
  stakes: 'Loser drops to #3 in Power Rankings. Winner gets a Cane Courier feature article.',
};

export const DEFAULT_RIVALRIES = [
  { title: 'The Hallway War',     teams: ['Mall Walkers', 'Centennial Centurions'], tags: ['MALL','CENT'], colors: ['#6f35ff','#5C6B2E'], record: 'MALL 4 — CENT 5 (lifetime)', note: 'Started Season 3 over a draft trade. Still unresolved. Voice-chat banned in this matchup.' },
  { title: 'Bedpan vs The World', teams: ['Bedpan Bandits', 'Field'],               tags: ['BEDP','FRH'],  colors: ['#CC3300','#111111'], record: 'BEDP 11 — Field 3 (S9)',      note: 'Every team in the league has now lost to the Bandits at least once. Discord has thoughts.' },
  { title: 'Old Friends Cup',     teams: ['Whiskey Wardens','Sundown Saboteurs'],   tags: ['WHIS','SUND'], colors: ['#8a4a13','#2B5BA8'], record: 'WHIS 6 — SUND 6',            note: "Captains used to duo queue. Now they don't speak. Trophy is a thrift-store mug." },
];

export const DEFAULT_KNOWS_BALL = [
  { who: 'FrankBot',        line: 'Bedpan Bandits cover the -4.5. Lock it.',                              conf: 92 },
  { who: 'Cane Courier',    line: 'Tyrants vs Phoenixes goes UNDER 28 minutes. Phoenixes fold at draft.', conf: 71 },
  { who: 'Admin Gremlin',   line: 'Whiskey Wardens win Game 3 but somebody quits voice chat.',            conf: 64 },
  { who: 'FraudWatch-9000', line: 'Centurions caught buying sentries again. Statistically inevitable.',   conf: 88 },
];

export const DEFAULT_WASHED_REPORTS = [
  { who: 'GrandpasGank',       what: 'Auto-attacked the wrong jungle camp. Twice.',          time: '12m ago'   },
  { who: 'DenturesOnLockdown', what: 'Bought 3 starter items at minute 19.',                 time: '1h ago'    },
  { who: 'WashedOutWanda',     what: 'Pinged her own base as "enemy missing."',              time: '2h ago'    },
  { who: 'PillboxPhil',        what: 'Surrendered a won game by accident.',                  time: '3h ago'    },
  { who: 'ShuffleboardSusano', what: 'Logged off mid-draft. Came back as a different god.',  time: 'yesterday' },
];

export const DEFAULT_SOCIAL_CARDS = [
  { kind: 'STAT',  title: '0',                        unit: 'boots purchased by Susano',     caption: 'since Season 6'                    },
  { kind: 'STAT',  title: '73%',                      unit: "win-rate of Bandits' Anubis",   caption: 'across 11 matches'                 },
  { kind: 'MEME',  title: '"gg ez"',                  unit: 'after a 0/12 loss',             caption: '— BrokenHipBruiser, 2026'          },
  { kind: 'QUOTE', title: '"I just queue and hope."', unit: 'captain, Pillbox Phoenixes',    caption: 'league sit-down, ep. 4'            },
  { kind: 'STAT',  title: '14',                       unit: 'wards purchased illegally',     caption: 'by Centurions, 4 min mark'         },
  { kind: 'MEME',  title: 'WASHED',                   unit: 'official league designation',   caption: 'applies to 4 of 7 current rosters' },
];

export const DEFAULT_DISCORD_INVITE_URL = 'https://discord.gg/HPAZmHmBpD';
export const DEFAULT_WASHED_PCT = 88;

// ── Default visibility (all on) ──────────────────────────────────────────────
export const DEFAULT_VISIBILITY = {
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

// ── Full defaults object (matches HomepageContent DB shape) ──────────────────
export const HOMEPAGE_DEFAULTS = {
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
  ...DEFAULT_VISIBILITY,
};

/**
 * Merge a partial DB HomepageContent row over the defaults.
 * Any missing/null field falls back to the default value.
 * Safe to call with null/undefined (returns full defaults).
 *
 * @param {object|null} dbRow
 * @returns {typeof HOMEPAGE_DEFAULTS}
 */
export function mergeWithDefaults(dbRow) {
  if (!dbRow) return { ...HOMEPAGE_DEFAULTS };
  return {
    ticker:           Array.isArray(dbRow.ticker)       && dbRow.ticker.length       ? dbRow.ticker       : DEFAULT_TICKER,
    headlines:        Array.isArray(dbRow.headlines)    && dbRow.headlines.length    ? dbRow.headlines    : DEFAULT_HEADLINES,
    bulletin:         Array.isArray(dbRow.bulletin)     && dbRow.bulletin.length     ? dbRow.bulletin     : DEFAULT_BULLETIN,
    fraudWatch:       Array.isArray(dbRow.fraudWatch)   && dbRow.fraudWatch.length   ? dbRow.fraudWatch   : DEFAULT_FRAUD_WATCH,
    motw:             dbRow.motw && typeof dbRow.motw === 'object' && dbRow.motw.title ? dbRow.motw       : DEFAULT_MOTW,
    rivalries:        Array.isArray(dbRow.rivalries)    && dbRow.rivalries.length    ? dbRow.rivalries    : DEFAULT_RIVALRIES,
    knowsBall:        Array.isArray(dbRow.knowsBall)    && dbRow.knowsBall.length    ? dbRow.knowsBall    : DEFAULT_KNOWS_BALL,
    washedReports:    Array.isArray(dbRow.washedReports)&& dbRow.washedReports.length? dbRow.washedReports: DEFAULT_WASHED_REPORTS,
    socialCards:      Array.isArray(dbRow.socialCards)  && dbRow.socialCards.length  ? dbRow.socialCards  : DEFAULT_SOCIAL_CARDS,
    discordInviteUrl: dbRow.discordInviteUrl || DEFAULT_DISCORD_INVITE_URL,
    washedPct:        typeof dbRow.washedPct === 'number' ? dbRow.washedPct          : DEFAULT_WASHED_PCT,
    showTicker:        dbRow.showTicker        ?? true,
    showHeadlines:     dbRow.showHeadlines     ?? true,
    showBulletin:      dbRow.showBulletin      ?? true,
    showFraudWatch:    dbRow.showFraudWatch    ?? true,
    showMotw:          dbRow.showMotw          ?? true,
    showRivalries:     dbRow.showRivalries     ?? true,
    showKnowsBall:     dbRow.showKnowsBall     ?? true,
    showWashedReports: dbRow.showWashedReports ?? true,
    showSocialCards:   dbRow.showSocialCards   ?? true,
  };
}
