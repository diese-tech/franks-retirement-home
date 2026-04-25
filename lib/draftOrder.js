// Ban order: alternating, 3 bans per team = 6 total
export const BAN_ORDER = ['A', 'B', 'A', 'B', 'A', 'B'];

// Pick order: snake draft, 5 picks per team = 10 total
export const PICK_ORDER = ['A', 'B', 'B', 'A', 'A', 'B', 'B', 'A', 'A', 'B'];

// Returns the team that acts at position `count`, or null when phase is done
export const currentBanTeam = (count) => BAN_ORDER[count] ?? null;
export const currentPickTeam = (count) => PICK_ORDER[count] ?? null;

export const TOTAL_BANS = BAN_ORDER.length;   // 6
export const TOTAL_PICKS = PICK_ORDER.length;  // 10
