import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHmac } from 'node:crypto';

// ─── Mock @/lib/db (imported by discordAuth.js) ──────────────────────────────
vi.mock('@/lib/db', () => {
  const prisma = {
    match: { findUnique: vi.fn() },
    draft: { findUnique: vi.fn() },
  };
  return { default: prisma };
});

const { default: prisma } = await import('@/lib/db');
const {
  validateDiscordEnv,
  hasDiscordAdminRole,
  hasDiscordCaptainRole,
  resolveTeamFromRoles,
  resolveDivisionFromRoles,
  buildDiscordSessionCookie,
  getDiscordSessionUser,
  resolveCaptainSideFromDiscord,
  resolveDraftRoleFromDiscord,
  DISCORD_SESSION_COOKIE,
} = await import('@/lib/discordAuth');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeReqWithCookie(cookieName, cookieValue, extraHeaders = {}) {
  return {
    headers: {
      get: (name) => {
        if (name === 'cookie') return `${cookieName}=${cookieValue}`;
        return extraHeaders[name] || null;
      },
    },
  };
}

function makeReqNoCookie() {
  return {
    headers: {
      get: () => null,
    },
  };
}

// ─── Env cleanup ─────────────────────────────────────────────────────────────

const ENV_KEYS = [
  'DISCORD_CLIENT_ID',
  'DISCORD_CLIENT_SECRET',
  'DISCORD_GUILD_ID',
  'DISCORD_SESSION_SECRET',
  'DISCORD_ADMIN_ROLE_ID',
  'DISCORD_CAPTAIN_ROLE_ID',
  'DISCORD_TEAM_ROLE_MAP_JSON',
  'DISCORD_HOSPICE_ROLE_ID',
  'DISCORD_REHABILITATION_ROLE_ID',
];

let savedEnv;

beforeEach(() => {
  savedEnv = {};
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
  }
  // Clear all Discord env vars
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
  vi.clearAllMocks();
});

afterEach(() => {
  // Restore env vars
  for (const key of ENV_KEYS) {
    if (savedEnv[key] !== undefined) {
      process.env[key] = savedEnv[key];
    } else {
      delete process.env[key];
    }
  }
});

// ─── validateDiscordEnv ──────────────────────────────────────────────────────

describe('validateDiscordEnv', () => {
  it('returns { valid: false, missing: [...] } when env vars are absent', () => {
    const result = validateDiscordEnv();
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('DISCORD_CLIENT_ID');
    expect(result.missing).toContain('DISCORD_CLIENT_SECRET');
    expect(result.missing).toContain('DISCORD_GUILD_ID');
    expect(result.missing).toContain('DISCORD_SESSION_SECRET');
    expect(result.missing).toHaveLength(4);
  });

  it('returns { valid: true, missing: [] } when all 4 required vars are set', () => {
    process.env.DISCORD_CLIENT_ID = 'test-client-id';
    process.env.DISCORD_CLIENT_SECRET = 'test-client-secret';
    process.env.DISCORD_GUILD_ID = 'test-guild-id';
    process.env.DISCORD_SESSION_SECRET = 'test-session-secret-long-enough';
    const result = validateDiscordEnv();
    expect(result.valid).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it('reports only the missing vars when some are set', () => {
    process.env.DISCORD_CLIENT_ID = 'test-client-id';
    process.env.DISCORD_SESSION_SECRET = 'test-session-secret-long-enough';
    const result = validateDiscordEnv();
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('DISCORD_CLIENT_SECRET');
    expect(result.missing).toContain('DISCORD_GUILD_ID');
    expect(result.missing).not.toContain('DISCORD_CLIENT_ID');
    expect(result.missing).not.toContain('DISCORD_SESSION_SECRET');
  });
});

// ─── hasDiscordAdminRole ─────────────────────────────────────────────────────

describe('hasDiscordAdminRole', () => {
  it('returns true when roles includes DISCORD_ADMIN_ROLE_ID', () => {
    process.env.DISCORD_ADMIN_ROLE_ID = 'admin-role-123';
    expect(hasDiscordAdminRole(['other-role', 'admin-role-123'])).toBe(true);
  });

  it('returns false when roles does not include it', () => {
    process.env.DISCORD_ADMIN_ROLE_ID = 'admin-role-123';
    expect(hasDiscordAdminRole(['other-role', 'captain-role'])).toBe(false);
  });

  it('returns false when DISCORD_ADMIN_ROLE_ID env is not set', () => {
    expect(hasDiscordAdminRole(['admin-role-123', 'other-role'])).toBe(false);
  });
});

// ─── hasDiscordCaptainRole ───────────────────────────────────────────────────

describe('hasDiscordCaptainRole', () => {
  it('returns true when roles includes DISCORD_CAPTAIN_ROLE_ID', () => {
    process.env.DISCORD_CAPTAIN_ROLE_ID = 'captain-role-456';
    expect(hasDiscordCaptainRole(['captain-role-456', 'other'])).toBe(true);
  });

  it('returns false when roles does not include it', () => {
    process.env.DISCORD_CAPTAIN_ROLE_ID = 'captain-role-456';
    expect(hasDiscordCaptainRole(['other-role'])).toBe(false);
  });

  it('returns false when DISCORD_CAPTAIN_ROLE_ID env is not set', () => {
    expect(hasDiscordCaptainRole(['captain-role-456'])).toBe(false);
  });
});

// ─── resolveTeamFromRoles ────────────────────────────────────────────────────

describe('resolveTeamFromRoles', () => {
  it('returns team ID when a role matches a value in DISCORD_TEAM_ROLE_MAP_JSON', () => {
    process.env.DISCORD_TEAM_ROLE_MAP_JSON = JSON.stringify({
      'team-alpha': 'role-111',
      'team-bravo': 'role-222',
    });
    expect(resolveTeamFromRoles(['role-222', 'unrelated'])).toBe('team-bravo');
  });

  it('returns null when no role matches', () => {
    process.env.DISCORD_TEAM_ROLE_MAP_JSON = JSON.stringify({
      'team-alpha': 'role-111',
    });
    expect(resolveTeamFromRoles(['role-999'])).toBeNull();
  });

  it('returns null when DISCORD_TEAM_ROLE_MAP_JSON is not set', () => {
    expect(resolveTeamFromRoles(['role-111'])).toBeNull();
  });

  it('returns null when DISCORD_TEAM_ROLE_MAP_JSON is invalid JSON', () => {
    process.env.DISCORD_TEAM_ROLE_MAP_JSON = 'not-valid-json{{{';
    expect(resolveTeamFromRoles(['role-111'])).toBeNull();
  });
});

// ─── resolveDivisionFromRoles ────────────────────────────────────────────────

describe('resolveDivisionFromRoles', () => {
  it("returns 'div-s9-hospice' when roles includes DISCORD_HOSPICE_ROLE_ID", () => {
    process.env.DISCORD_HOSPICE_ROLE_ID = 'hospice-role-id';
    expect(resolveDivisionFromRoles(['hospice-role-id', 'other'])).toBe('div-s9-hospice');
  });

  it("returns 'div-s9-rehabilitation' when roles includes DISCORD_REHABILITATION_ROLE_ID", () => {
    process.env.DISCORD_REHABILITATION_ROLE_ID = 'rehab-role-id';
    expect(resolveDivisionFromRoles(['rehab-role-id'])).toBe('div-s9-rehabilitation');
  });

  it('returns null when neither matches', () => {
    process.env.DISCORD_HOSPICE_ROLE_ID = 'hospice-role-id';
    process.env.DISCORD_REHABILITATION_ROLE_ID = 'rehab-role-id';
    expect(resolveDivisionFromRoles(['unrelated'])).toBeNull();
  });

  it('prefers hospice when both roles are present', () => {
    process.env.DISCORD_HOSPICE_ROLE_ID = 'hospice-role-id';
    process.env.DISCORD_REHABILITATION_ROLE_ID = 'rehab-role-id';
    expect(resolveDivisionFromRoles(['hospice-role-id', 'rehab-role-id'])).toBe('div-s9-hospice');
  });
});

// ─── buildDiscordSessionCookie + getDiscordSessionUser round-trip ─────────────

describe('buildDiscordSessionCookie + getDiscordSessionUser round-trip', () => {
  beforeEach(() => {
    process.env.DISCORD_SESSION_SECRET = 'test-secret-at-least-16-chars';
  });

  it('a cookie built with valid data can be read back correctly', () => {
    const sessionData = {
      discordId: '123456789',
      username: 'TestUser',
      roles: ['role-a', 'role-b'],
    };
    const cookie = buildDiscordSessionCookie(sessionData);
    const req = makeReqWithCookie(DISCORD_SESSION_COOKIE, cookie);
    const result = getDiscordSessionUser(req);
    expect(result).not.toBeNull();
    expect(result.discordId).toBe('123456789');
    expect(result.username).toBe('TestUser');
    expect(result.roles).toEqual(['role-a', 'role-b']);
  });

  it('an expired cookie returns null', () => {
    const sessionData = {
      discordId: '123456789',
      username: 'TestUser',
      roles: ['role-a'],
    };
    const cookie = buildDiscordSessionCookie(sessionData);

    // Manually create an expired cookie by tampering with exp
    // Instead, we use time manipulation via vi.useFakeTimers
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);
    const validCookie = buildDiscordSessionCookie(sessionData);

    // Advance time past 24 hours
    vi.setSystemTime(now + 25 * 60 * 60 * 1000);
    const req = makeReqWithCookie(DISCORD_SESSION_COOKIE, validCookie);
    const result = getDiscordSessionUser(req);
    expect(result).toBeNull();
    vi.useRealTimers();
  });

  it('a tampered cookie (modified payload) returns null', () => {
    const sessionData = {
      discordId: '123456789',
      username: 'TestUser',
      roles: ['role-a'],
    };
    const cookie = buildDiscordSessionCookie(sessionData);
    // Tamper with the payload portion (before the dot)
    const parts = cookie.split('.');
    // Modify the encoded payload slightly
    const tamperedPayload = parts[0] + 'XX';
    const tamperedCookie = `${tamperedPayload}.${parts[1]}`;
    const req = makeReqWithCookie(DISCORD_SESSION_COOKIE, tamperedCookie);
    const result = getDiscordSessionUser(req);
    expect(result).toBeNull();
  });

  it('a cookie with missing fields returns null', () => {
    // Manually create a cookie with missing discordId field
    const secret = 'test-secret-at-least-16-chars';
    const payload = JSON.stringify({ username: 'Test', roles: [], exp: Date.now() + 60000 });
    const encoded = Buffer.from(payload, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const sig = Buffer.from(createHmac('sha256', secret).update(encoded).digest()).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const cookie = `${encoded}.${sig}`;
    const req = makeReqWithCookie(DISCORD_SESSION_COOKIE, cookie);
    const result = getDiscordSessionUser(req);
    expect(result).toBeNull();
  });

  it('request with no cookie header returns null', () => {
    const req = makeReqNoCookie();
    const result = getDiscordSessionUser(req);
    expect(result).toBeNull();
  });

  it('request with wrong cookie name returns null', () => {
    const sessionData = {
      discordId: '123456789',
      username: 'TestUser',
      roles: ['role-a'],
    };
    const cookie = buildDiscordSessionCookie(sessionData);
    const req = makeReqWithCookie('wrong_cookie_name', cookie);
    const result = getDiscordSessionUser(req);
    expect(result).toBeNull();
  });
});

// ─── resolveCaptainSideFromDiscord ───────────────────────────────────────────

describe('resolveCaptainSideFromDiscord', () => {
  const MATCH_ID = 'match-test-1';

  beforeEach(() => {
    process.env.DISCORD_CAPTAIN_ROLE_ID = 'captain-role';
    process.env.DISCORD_TEAM_ROLE_MAP_JSON = JSON.stringify({
      'team-home': 'team-home-role',
      'team-away': 'team-away-role',
    });
    process.env.DISCORD_HOSPICE_ROLE_ID = 'hospice-role';
    process.env.DISCORD_REHABILITATION_ROLE_ID = 'rehab-role';
  });

  it("captain role + correct team + correct division -> 'home'", async () => {
    prisma.match.findUnique.mockResolvedValue({
      homeTeamId: 'team-home',
      awayTeamId: 'team-away',
      homeTeam: { divisionId: 'div-s9-hospice' },
      awayTeam: { divisionId: 'div-s9-rehabilitation' },
    });
    const roles = ['captain-role', 'team-home-role', 'hospice-role'];
    const result = await resolveCaptainSideFromDiscord(MATCH_ID, roles);
    expect(result).toBe('home');
  });

  it("captain role + correct away team + correct division -> 'away'", async () => {
    prisma.match.findUnique.mockResolvedValue({
      homeTeamId: 'team-home',
      awayTeamId: 'team-away',
      homeTeam: { divisionId: 'div-s9-hospice' },
      awayTeam: { divisionId: 'div-s9-rehabilitation' },
    });
    const roles = ['captain-role', 'team-away-role', 'rehab-role'];
    const result = await resolveCaptainSideFromDiscord(MATCH_ID, roles);
    expect(result).toBe('away');
  });

  it('captain role + wrong team -> null', async () => {
    prisma.match.findUnique.mockResolvedValue({
      homeTeamId: 'team-home',
      awayTeamId: 'team-away',
      homeTeam: { divisionId: 'div-s9-hospice' },
      awayTeam: { divisionId: 'div-s9-rehabilitation' },
    });
    // Has captain role but the team role does not match home or away
    process.env.DISCORD_TEAM_ROLE_MAP_JSON = JSON.stringify({
      'team-home': 'team-home-role',
      'team-away': 'team-away-role',
      'team-other': 'team-other-role',
    });
    const roles = ['captain-role', 'team-other-role', 'hospice-role'];
    const result = await resolveCaptainSideFromDiscord(MATCH_ID, roles);
    expect(result).toBeNull();
  });

  it('captain role + correct team + wrong division -> null', async () => {
    prisma.match.findUnique.mockResolvedValue({
      homeTeamId: 'team-home',
      awayTeamId: 'team-away',
      homeTeam: { divisionId: 'div-s9-hospice' },
      awayTeam: { divisionId: 'div-s9-rehabilitation' },
    });
    // Has home team role but rehab division (home team is hospice)
    const roles = ['captain-role', 'team-home-role', 'rehab-role'];
    const result = await resolveCaptainSideFromDiscord(MATCH_ID, roles);
    expect(result).toBeNull();
  });

  it('no captain role -> null', async () => {
    const roles = ['team-home-role', 'hospice-role'];
    const result = await resolveCaptainSideFromDiscord(MATCH_ID, roles);
    expect(result).toBeNull();
    // Should not even query DB
    expect(prisma.match.findUnique).not.toHaveBeenCalled();
  });

  it('no team role match -> null', async () => {
    const roles = ['captain-role', 'hospice-role']; // no team role
    const result = await resolveCaptainSideFromDiscord(MATCH_ID, roles);
    expect(result).toBeNull();
    expect(prisma.match.findUnique).not.toHaveBeenCalled();
  });

  it('match not found -> null', async () => {
    prisma.match.findUnique.mockResolvedValue(null);
    const roles = ['captain-role', 'team-home-role', 'hospice-role'];
    const result = await resolveCaptainSideFromDiscord(MATCH_ID, roles);
    expect(result).toBeNull();
  });
});

// ─── resolveDraftRoleFromDiscord ─────────────────────────────────────────────

describe('resolveDraftRoleFromDiscord', () => {
  const DRAFT_ID = 'draft-test-1';

  beforeEach(() => {
    process.env.DISCORD_ADMIN_ROLE_ID = 'admin-role';
    process.env.DISCORD_CAPTAIN_ROLE_ID = 'captain-role';
    process.env.DISCORD_TEAM_ROLE_MAP_JSON = JSON.stringify({
      'team-home': 'team-home-role',
      'team-away': 'team-away-role',
    });
    process.env.DISCORD_HOSPICE_ROLE_ID = 'hospice-role';
    process.env.DISCORD_REHABILITATION_ROLE_ID = 'rehab-role';
  });

  it("admin role -> 'admin' (does not need DB lookup)", async () => {
    const roles = ['admin-role'];
    const result = await resolveDraftRoleFromDiscord(DRAFT_ID, roles);
    expect(result).toBe('admin');
    expect(prisma.draft.findUnique).not.toHaveBeenCalled();
  });

  it("captain + correct home team -> 'captainA'", async () => {
    prisma.draft.findUnique.mockResolvedValue({
      gameId: 'game-1',
      game: {
        match: {
          id: 'match-1',
          homeTeamId: 'team-home',
          awayTeamId: 'team-away',
          homeTeam: { divisionId: 'div-s9-hospice' },
          awayTeam: { divisionId: 'div-s9-rehabilitation' },
        },
      },
    });
    const roles = ['captain-role', 'team-home-role', 'hospice-role'];
    const result = await resolveDraftRoleFromDiscord(DRAFT_ID, roles);
    expect(result).toBe('captainA');
  });

  it("captain + correct away team -> 'captainB'", async () => {
    prisma.draft.findUnique.mockResolvedValue({
      gameId: 'game-1',
      game: {
        match: {
          id: 'match-1',
          homeTeamId: 'team-home',
          awayTeamId: 'team-away',
          homeTeam: { divisionId: 'div-s9-hospice' },
          awayTeam: { divisionId: 'div-s9-rehabilitation' },
        },
      },
    });
    const roles = ['captain-role', 'team-away-role', 'rehab-role'];
    const result = await resolveDraftRoleFromDiscord(DRAFT_ID, roles);
    expect(result).toBe('captainB');
  });

  it("standalone draft (no gameId) -> 'spectator'", async () => {
    prisma.draft.findUnique.mockResolvedValue({
      gameId: null,
      game: null,
    });
    const roles = ['captain-role', 'team-home-role', 'hospice-role'];
    const result = await resolveDraftRoleFromDiscord(DRAFT_ID, roles);
    expect(result).toBe('spectator');
  });

  it("captain + wrong team -> 'spectator'", async () => {
    prisma.draft.findUnique.mockResolvedValue({
      gameId: 'game-1',
      game: {
        match: {
          id: 'match-1',
          homeTeamId: 'team-home',
          awayTeamId: 'team-away',
          homeTeam: { divisionId: 'div-s9-hospice' },
          awayTeam: { divisionId: 'div-s9-rehabilitation' },
        },
      },
    });
    process.env.DISCORD_TEAM_ROLE_MAP_JSON = JSON.stringify({
      'team-home': 'team-home-role',
      'team-away': 'team-away-role',
      'team-other': 'team-other-role',
    });
    const roles = ['captain-role', 'team-other-role', 'hospice-role'];
    const result = await resolveDraftRoleFromDiscord(DRAFT_ID, roles);
    expect(result).toBe('spectator');
  });

  it("draft not found -> 'spectator'", async () => {
    prisma.draft.findUnique.mockResolvedValue(null);
    const roles = ['captain-role', 'team-home-role', 'hospice-role'];
    const result = await resolveDraftRoleFromDiscord(DRAFT_ID, roles);
    expect(result).toBe('spectator');
  });

  it("no captain role (non-admin) -> 'spectator'", async () => {
    prisma.draft.findUnique.mockResolvedValue({
      gameId: 'game-1',
      game: {
        match: {
          id: 'match-1',
          homeTeamId: 'team-home',
          awayTeamId: 'team-away',
          homeTeam: { divisionId: 'div-s9-hospice' },
          awayTeam: { divisionId: 'div-s9-rehabilitation' },
        },
      },
    });
    const roles = ['team-home-role', 'hospice-role']; // no captain or admin role
    const result = await resolveDraftRoleFromDiscord(DRAFT_ID, roles);
    expect(result).toBe('spectator');
  });
});
