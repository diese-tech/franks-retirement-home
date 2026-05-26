import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@/lib/discordAuth', () => ({
  getDiscordSessionUser: vi.fn(),
  hasDiscordAdminRole: vi.fn(),
  resolveCaptainSideFromDiscord: vi.fn(),
  resolveDraftRoleFromDiscord: vi.fn(),
}));

vi.mock('@/lib/matchWindow', () => ({
  resolveCaptainSide: vi.fn(),
}));

vi.mock('@/lib/draftAuth', () => ({
  resolveRole: vi.fn(),
}));

vi.mock('@/lib/adminSession', () => ({
  requireAdmin: vi.fn(),
}));

const { getDiscordSessionUser, hasDiscordAdminRole, resolveCaptainSideFromDiscord, resolveDraftRoleFromDiscord } = await import('@/lib/discordAuth');
const { resolveCaptainSide } = await import('@/lib/matchWindow');
const { resolveRole } = await import('@/lib/draftAuth');
const { requireAdmin } = await import('@/lib/adminSession');
const { resolveMatchCaptainAuth, resolveDraftCaptainAuth, resolveAdminAuth } = await import('@/lib/resolveAuth');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(captainKey = null) {
  return {
    headers: {
      get: (name) => {
        if (name === 'x-captain-key') return captainKey;
        return null;
      },
    },
  };
}

const MATCH = {
  id: 'match-1',
  homeTeamCaptainKey: 'home-key',
  awayTeamCaptainKey: 'away-key',
};

const DRAFT = {
  id: 'draft-1',
  adminKey: 'admin-key',
  captainAKey: 'captain-a-key',
  captainBKey: 'captain-b-key',
};

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Default: no Discord session
  getDiscordSessionUser.mockReturnValue(null);
  hasDiscordAdminRole.mockReturnValue(false);
  resolveCaptainSideFromDiscord.mockResolvedValue(null);
  resolveDraftRoleFromDiscord.mockResolvedValue('spectator');
  resolveCaptainSide.mockReturnValue(null);
  resolveRole.mockReturnValue('spectator');
  requireAdmin.mockReturnValue({ _body: { error: 'Unauthorized' }, _status: 401 });
});

// ─── resolveMatchCaptainAuth ─────────────────────────────────────────────────

describe('resolveMatchCaptainAuth', () => {
  it('Discord session with admin role -> { side: null, source: discord, isAdmin: true }', async () => {
    const session = { discordId: '1', username: 'Admin', roles: ['admin-role'] };
    getDiscordSessionUser.mockReturnValue(session);
    hasDiscordAdminRole.mockReturnValue(true);

    const req = makeRequest();
    const result = await resolveMatchCaptainAuth(req, MATCH);
    expect(result).toEqual({ side: null, source: 'discord', isAdmin: true });
    // Should not call resolveCaptainSideFromDiscord when admin
    expect(resolveCaptainSideFromDiscord).not.toHaveBeenCalled();
  });

  it("Discord session with captain role resolving to 'home' -> { side: 'home', source: 'discord', isAdmin: false }", async () => {
    const session = { discordId: '2', username: 'Captain', roles: ['captain-role', 'team-role'] };
    getDiscordSessionUser.mockReturnValue(session);
    hasDiscordAdminRole.mockReturnValue(false);
    resolveCaptainSideFromDiscord.mockResolvedValue('home');

    const req = makeRequest();
    const result = await resolveMatchCaptainAuth(req, MATCH);
    expect(result).toEqual({ side: 'home', source: 'discord', isAdmin: false });
    expect(resolveCaptainSideFromDiscord).toHaveBeenCalledWith('match-1', session.roles);
  });

  it("Discord session with captain role resolving to 'away' -> { side: 'away', source: 'discord', isAdmin: false }", async () => {
    const session = { discordId: '3', username: 'Captain2', roles: ['captain-role', 'away-team-role'] };
    getDiscordSessionUser.mockReturnValue(session);
    hasDiscordAdminRole.mockReturnValue(false);
    resolveCaptainSideFromDiscord.mockResolvedValue('away');

    const req = makeRequest();
    const result = await resolveMatchCaptainAuth(req, MATCH);
    expect(result).toEqual({ side: 'away', source: 'discord', isAdmin: false });
  });

  it("Discord session present but no captain match -> falls back to X-Captain-Key -> { side: 'home', source: 'key', isAdmin: false }", async () => {
    const session = { discordId: '4', username: 'NoCaptain', roles: ['some-role'] };
    getDiscordSessionUser.mockReturnValue(session);
    hasDiscordAdminRole.mockReturnValue(false);
    resolveCaptainSideFromDiscord.mockResolvedValue(null);
    resolveCaptainSide.mockReturnValue('home');

    const req = makeRequest('home-key');
    const result = await resolveMatchCaptainAuth(req, MATCH);
    expect(result).toEqual({ side: 'home', source: 'key', isAdmin: false });
    expect(resolveCaptainSide).toHaveBeenCalledWith(MATCH, 'home-key');
  });

  it("No Discord session + valid captain key -> { side: 'away', source: 'key', isAdmin: false }", async () => {
    getDiscordSessionUser.mockReturnValue(null);
    resolveCaptainSide.mockReturnValue('away');

    const req = makeRequest('away-key');
    const result = await resolveMatchCaptainAuth(req, MATCH);
    expect(result).toEqual({ side: 'away', source: 'key', isAdmin: false });
    expect(resolveCaptainSide).toHaveBeenCalledWith(MATCH, 'away-key');
  });

  it('No Discord session + no valid key -> { side: null, source: null, isAdmin: false }', async () => {
    getDiscordSessionUser.mockReturnValue(null);
    resolveCaptainSide.mockReturnValue(null);

    const req = makeRequest(null);
    const result = await resolveMatchCaptainAuth(req, MATCH);
    expect(result).toEqual({ side: null, source: null, isAdmin: false });
  });

  it('Discord session with team role but missing captain role (resolveCaptainSideFromDiscord returns null) -> falls back to key', async () => {
    const session = { discordId: '5', username: 'TeamMember', roles: ['team-role'] };
    getDiscordSessionUser.mockReturnValue(session);
    hasDiscordAdminRole.mockReturnValue(false);
    resolveCaptainSideFromDiscord.mockResolvedValue(null);
    resolveCaptainSide.mockReturnValue('home');

    const req = makeRequest('home-key');
    const result = await resolveMatchCaptainAuth(req, MATCH);
    expect(result).toEqual({ side: 'home', source: 'key', isAdmin: false });
  });

  it('Discord session with no resolution and no key -> spectator', async () => {
    const session = { discordId: '6', username: 'Spectator', roles: [] };
    getDiscordSessionUser.mockReturnValue(session);
    hasDiscordAdminRole.mockReturnValue(false);
    resolveCaptainSideFromDiscord.mockResolvedValue(null);
    resolveCaptainSide.mockReturnValue(null);

    const req = makeRequest(null);
    const result = await resolveMatchCaptainAuth(req, MATCH);
    expect(result).toEqual({ side: null, source: null, isAdmin: false });
  });
});

// ─── resolveDraftCaptainAuth ─────────────────────────────────────────────────

describe('resolveDraftCaptainAuth', () => {
  it("Discord admin role -> { role: 'admin', source: 'discord' }", async () => {
    const session = { discordId: '1', username: 'Admin', roles: ['admin-role'] };
    getDiscordSessionUser.mockReturnValue(session);
    resolveDraftRoleFromDiscord.mockResolvedValue('admin');

    const req = makeRequest();
    const result = await resolveDraftCaptainAuth(req, DRAFT, null);
    expect(result).toEqual({ role: 'admin', source: 'discord' });
    expect(resolveDraftRoleFromDiscord).toHaveBeenCalledWith('draft-1', session.roles);
  });

  it("Discord captain resolves to 'captainA' -> { role: 'captainA', source: 'discord' }", async () => {
    const session = { discordId: '2', username: 'CaptainA', roles: ['captain-role', 'team-role'] };
    getDiscordSessionUser.mockReturnValue(session);
    resolveDraftRoleFromDiscord.mockResolvedValue('captainA');

    const req = makeRequest();
    const result = await resolveDraftCaptainAuth(req, DRAFT, null);
    expect(result).toEqual({ role: 'captainA', source: 'discord' });
  });

  it("Discord session but spectator for this draft -> falls back to key role", async () => {
    const session = { discordId: '3', username: 'NoMatch', roles: ['other-role'] };
    getDiscordSessionUser.mockReturnValue(session);
    resolveDraftRoleFromDiscord.mockResolvedValue('spectator');
    resolveRole.mockReturnValue('captainB');

    const req = makeRequest();
    const result = await resolveDraftCaptainAuth(req, DRAFT, 'captain-b-key');
    expect(result).toEqual({ role: 'captainB', source: 'key' });
    expect(resolveRole).toHaveBeenCalledWith('captain-b-key', DRAFT);
  });

  it("No session -> key-based resolveRole result", async () => {
    getDiscordSessionUser.mockReturnValue(null);
    resolveRole.mockReturnValue('admin');

    const req = makeRequest();
    const result = await resolveDraftCaptainAuth(req, DRAFT, 'admin-key');
    expect(result).toEqual({ role: 'admin', source: 'key' });
    expect(resolveRole).toHaveBeenCalledWith('admin-key', DRAFT);
  });

  it("No session + no key -> { role: 'spectator', source: 'key' }", async () => {
    getDiscordSessionUser.mockReturnValue(null);
    resolveRole.mockReturnValue('spectator');

    const req = makeRequest();
    const result = await resolveDraftCaptainAuth(req, DRAFT, null);
    expect(result).toEqual({ role: 'spectator', source: 'key' });
    expect(resolveRole).toHaveBeenCalledWith(null, DRAFT);
  });

  it("Discord captain resolves to 'captainB' -> { role: 'captainB', source: 'discord' }", async () => {
    const session = { discordId: '4', username: 'CaptainB', roles: ['captain-role', 'away-team-role'] };
    getDiscordSessionUser.mockReturnValue(session);
    resolveDraftRoleFromDiscord.mockResolvedValue('captainB');

    const req = makeRequest();
    const result = await resolveDraftCaptainAuth(req, DRAFT, null);
    expect(result).toEqual({ role: 'captainB', source: 'discord' });
  });
});

// ─── resolveAdminAuth ────────────────────────────────────────────────────────

describe('resolveAdminAuth', () => {
  it('Discord admin session -> returns null (authorized)', async () => {
    const session = { discordId: '1', username: 'Admin', roles: ['admin-role'] };
    getDiscordSessionUser.mockReturnValue(session);
    hasDiscordAdminRole.mockReturnValue(true);

    const req = makeRequest();
    const result = await resolveAdminAuth(req);
    expect(result).toBeNull();
    // Should not even check requireAdmin
    expect(requireAdmin).not.toHaveBeenCalled();
  });

  it('No Discord session, valid admin cookie -> returns null (from requireAdmin returning null)', async () => {
    getDiscordSessionUser.mockReturnValue(null);
    requireAdmin.mockReturnValue(null);

    const req = makeRequest();
    const result = await resolveAdminAuth(req);
    expect(result).toBeNull();
    expect(requireAdmin).toHaveBeenCalledWith(req);
  });

  it('No Discord session, invalid admin cookie -> returns 401 response', async () => {
    getDiscordSessionUser.mockReturnValue(null);
    const unauthorizedResponse = { _body: { error: 'Admin authentication required' }, _status: 401 };
    requireAdmin.mockReturnValue(unauthorizedResponse);

    const req = makeRequest();
    const result = await resolveAdminAuth(req);
    expect(result).toEqual(unauthorizedResponse);
    expect(result._status).toBe(401);
  });

  it('Discord session present but not admin -> falls back to requireAdmin', async () => {
    const session = { discordId: '2', username: 'Regular', roles: ['captain-role'] };
    getDiscordSessionUser.mockReturnValue(session);
    hasDiscordAdminRole.mockReturnValue(false);
    requireAdmin.mockReturnValue(null); // admin cookie is valid

    const req = makeRequest();
    const result = await resolveAdminAuth(req);
    expect(result).toBeNull();
    expect(requireAdmin).toHaveBeenCalledWith(req);
  });

  it('Discord session not admin + invalid admin cookie -> returns 401', async () => {
    const session = { discordId: '3', username: 'Regular', roles: ['other-role'] };
    getDiscordSessionUser.mockReturnValue(session);
    hasDiscordAdminRole.mockReturnValue(false);
    const unauthorizedResponse = { _body: { error: 'Admin authentication required' }, _status: 401 };
    requireAdmin.mockReturnValue(unauthorizedResponse);

    const req = makeRequest();
    const result = await resolveAdminAuth(req);
    expect(result).toEqual(unauthorizedResponse);
  });
});
