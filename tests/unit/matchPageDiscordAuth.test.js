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

const { getDiscordSessionUser, resolveCaptainSideFromDiscord } = await import('@/lib/discordAuth');
const { resolveCaptainSide } = await import('@/lib/matchWindow');
const { resolveMatchCaptainAuth } = await import('@/lib/resolveAuth');

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
  homeTeamId: 'team-home',
  awayTeamId: 'team-away',
  homeTeamCaptainKey: 'home-key',
  awayTeamCaptainKey: 'away-key',
};

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  getDiscordSessionUser.mockReturnValue(null);
  resolveCaptainSideFromDiscord.mockResolvedValue(null);
  resolveCaptainSide.mockReturnValue(null);
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Match page Discord auth resolution', () => {
  it('Discord session resolving to "home" -> captainSide is "home"', async () => {
    const session = { discordId: '1', username: 'HomeCaptain', roles: ['captain-role', 'home-team-role'] };
    getDiscordSessionUser.mockReturnValue(session);
    resolveCaptainSideFromDiscord.mockResolvedValue('home');

    const req = makeRequest();
    const result = await resolveMatchCaptainAuth(req, MATCH);
    expect(result.side).toBe('home');
    expect(result.source).toBe('discord');
  });

  it('Discord session resolves to null but key resolves to "away" -> captainSide is "away" (fallback)', async () => {
    const session = { discordId: '2', username: 'NoMatch', roles: ['other-role'] };
    getDiscordSessionUser.mockReturnValue(session);
    resolveCaptainSideFromDiscord.mockResolvedValue(null);
    resolveCaptainSide.mockReturnValue('away');

    const req = makeRequest('away-key');
    const result = await resolveMatchCaptainAuth(req, MATCH);
    expect(result.side).toBe('away');
    expect(result.source).toBe('key');
  });

  it('No Discord session and no key -> captainSide is null (spectator)', async () => {
    getDiscordSessionUser.mockReturnValue(null);
    resolveCaptainSide.mockReturnValue(null);

    const req = makeRequest(null);
    const result = await resolveMatchCaptainAuth(req, MATCH);
    expect(result.side).toBeNull();
    expect(result.source).toBeNull();
  });

  it('Discord session resolving to "away" -> captainSide is "away"', async () => {
    const session = { discordId: '3', username: 'AwayCaptain', roles: ['captain-role', 'away-team-role'] };
    getDiscordSessionUser.mockReturnValue(session);
    resolveCaptainSideFromDiscord.mockResolvedValue('away');

    const req = makeRequest();
    const result = await resolveMatchCaptainAuth(req, MATCH);
    expect(result.side).toBe('away');
    expect(result.source).toBe('discord');
  });

  it('Discord is tried first before key fallback', async () => {
    const session = { discordId: '4', username: 'Captain', roles: ['captain-role'] };
    getDiscordSessionUser.mockReturnValue(session);
    resolveCaptainSideFromDiscord.mockResolvedValue('home');
    resolveCaptainSide.mockReturnValue('away'); // key would resolve differently

    const req = makeRequest('away-key');
    const result = await resolveMatchCaptainAuth(req, MATCH);
    // Discord takes priority
    expect(result.side).toBe('home');
    expect(result.source).toBe('discord');
    // Key-based resolution should not be called
    expect(resolveCaptainSide).not.toHaveBeenCalled();
  });
});
