// ─── Homepage Editorial Defaults ─────────────────────────────────────────────
//
// These are the canonical fallback values for all editable homepage sections.
// The public page uses these when no "published" HomepageContent row exists in DB.
// The admin editor pre-fills these when no draft exists.
// Reset to Default deletes the DB draft and falls back here.
//
// Shape of each array item / object is the ground truth for the JSON columns
// in the HomepageContent Prisma model.

export const DEFAULT_TICKER = [];

export const DEFAULT_HEADLINES = [];

export const DEFAULT_BULLETIN = [];

export const DEFAULT_FRAUD_WATCH = [];

export const DEFAULT_MOTW = {
  title: '',
  when: '',
  storyline: '',
  h2h: [],
  stakes: '',
};

export const DEFAULT_RIVALRIES = [];

export const DEFAULT_KNOWS_BALL = [];

export const DEFAULT_WASHED_REPORTS = [];

export const DEFAULT_SOCIAL_CARDS = [];

export const DEFAULT_DISCORD_INVITE_URL = 'https://discord.gg/HPAZmHmBpD';
export const DEFAULT_WASHED_PCT = 88;

// ── Default visibility (all on) ──────────────────────────────────────────────
// Sections are visible by default. When a section has no content it shows
// a branded empty state rather than disappearing entirely. Admins can
// explicitly hide a section via the homepage editor toggle.
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
