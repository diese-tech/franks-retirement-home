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

const { getDiscordSessionUser, resolveDraftRoleFromDiscord } = await import('@/lib/discordAuth');
const { resolveRole } = await import('@/lib/draftAuth');
const { resolveDraftCaptainAuth } = await import('@/lib/resolveAuth');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest() {
  return {
    headers: {
      get: () => null,
    },
  };
}

const DRAFT = {
  id: 'draft-1',
  adminKey: 'admin-key',
  captainAKey: 'captain-a-key',
  captainBKey: 'captain-b-key',
};

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  getDiscordSessionUser.mockReturnValue(null);
  resolveDraftRoleFromDiscord.mockResolvedValue('spectator');
  resolveRole.mockReturnValue('spectator');
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Draft page Discord auth resolution', () => {
  it('Discord session resolving to "captainA" -> role is "captainA"', async () => {
    const session = { discordId: '1', username: 'CaptainA', roles: ['captain-role', 'team-a-role'] };
    getDiscordSessionUser.mockReturnValue(session);
    resolveDraftRoleFromDiscord.mockResolvedValue('captainA');

    const req = makeRequest();
    const result = await resolveDraftCaptainAuth(req, DRAFT, null);
    expect(result.role).toBe('captainA');
    expect(result.source).toBe('discord');
  });

  it('Discord session resolving to "spectator" but key resolves to "captainB" -> role is "captainB" (fallback)', async () => {
    const session = { discordId: '2', username: 'NoMatch', roles: ['other-role'] };
    getDiscordSessionUser.mockReturnValue(session);
    resolveDraftRoleFromDiscord.mockResolvedValue('spectator');
    resolveRole.mockReturnValue('captainB');

    const req = makeRequest();
    const result = await resolveDraftCaptainAuth(req, DRAFT, 'captain-b-key');
    expect(result.role).toBe('captainB');
    expect(result.source).toBe('key');
  });

  it('No Discord session and key resolves to "admin" -> role is "admin"', async () => {
    getDiscordSessionUser.mockReturnValue(null);
    resolveRole.mockReturnValue('admin');

    const req = makeRequest();
    const result = await resolveDraftCaptainAuth(req, DRAFT, 'admin-key');
    expect(result.role).toBe('admin');
    expect(result.source).toBe('key');
  });

  it('No Discord session and no key -> role is "spectator"', async () => {
    getDiscordSessionUser.mockReturnValue(null);
    resolveRole.mockReturnValue('spectator');

    const req = makeRequest();
    const result = await resolveDraftCaptainAuth(req, DRAFT, null);
    expect(result.role).toBe('spectator');
    expect(result.source).toBe('key');
  });

  it('Discord is tried first - captainB from Discord takes priority over key', async () => {
    const session = { discordId: '3', username: 'CaptainB', roles: ['captain-role', 'team-b-role'] };
    getDiscordSessionUser.mockReturnValue(session);
    resolveDraftRoleFromDiscord.mockResolvedValue('captainB');
    resolveRole.mockReturnValue('admin'); // key would resolve differently

    const req = makeRequest();
    const result = await resolveDraftCaptainAuth(req, DRAFT, 'admin-key');
    expect(result.role).toBe('captainB');
    expect(result.source).toBe('discord');
    // resolveRole should not be called when Discord resolves successfully
    expect(resolveRole).not.toHaveBeenCalled();
  });
});
