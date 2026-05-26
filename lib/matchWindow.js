/**
 * matchWindow.js
 *
 * Eligibility window helpers — canonical doctrine §7.
 *
 * The eligibility window derives ONLY from defaultScheduledAt.
 * Rescheduling (updating scheduledAt) never shifts this window.
 *
 *   eligibleStart = defaultScheduledAt - WINDOW_DAYS
 *   eligibleEnd   = defaultScheduledAt + WINDOW_DAYS
 *
 * Admins may override the window check by passing { adminOverride: true }.
 * Captain-gated actions must always pass through this check.
 */

export const WINDOW_DAYS = 6;
const WINDOW_MS = WINDOW_DAYS * 24 * 60 * 60 * 1000;

/**
 * Compute the eligibility window boundaries for a match.
 *
 * @param {Date|string|null} defaultScheduledAt
 * @returns {{ start: Date, end: Date } | null}
 *   null when defaultScheduledAt is not set (window is unconstrained — treated
 *   as open so legacy/test matches without an anchor are not accidentally locked).
 */
export function getMatchWindow(defaultScheduledAt) {
  if (!defaultScheduledAt) return null;
  const anchor = new Date(defaultScheduledAt);
  if (isNaN(anchor.getTime())) return null;
  return {
    start: new Date(anchor.getTime() - WINDOW_MS),
    end:   new Date(anchor.getTime() + WINDOW_MS),
  };
}

/**
 * Check whether a captain action is permitted right now.
 *
 * @param {object} match  Must include { defaultScheduledAt }
 * @param {object} [opts]
 * @param {boolean} [opts.adminOverride]  When true, always returns ok.
 * @param {Date}    [opts.now]            Injectable clock for testing.
 * @returns {{ ok: boolean, reason?: string, window?: { start: Date, end: Date } }}
 */
export function checkMatchWindow(match, { adminOverride = false, now = new Date() } = {}) {
  if (adminOverride) return { ok: true };

  const window = getMatchWindow(match.defaultScheduledAt);

  // No anchor set → window is open (back-compat for matches created before this field existed)
  if (!window) return { ok: true };

  if (now < window.start) {
    return {
      ok: false,
      reason: `Match actions are not yet available. The eligibility window opens on ${window.start.toUTCString()}.`,
      window,
    };
  }

  if (now > window.end) {
    return {
      ok: false,
      reason: `Match actions are no longer available. The eligibility window closed on ${window.end.toUTCString()}.`,
      window,
    };
  }

  return { ok: true, window };
}

/**
 * Resolve which captain side (home|away|null) a given key belongs to.
 *
 * @param {object} match  Must include { homeTeamCaptainKey, awayTeamCaptainKey }
 * @param {string|null} captainKey
 * @returns {'home'|'away'|null}
 */
export function resolveCaptainSide(match, captainKey) {
  if (!captainKey) return null;
  if (captainKey === match.homeTeamCaptainKey) return 'home';
  if (captainKey === match.awayTeamCaptainKey) return 'away';
  return null;
}
