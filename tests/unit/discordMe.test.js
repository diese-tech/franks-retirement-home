import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({ _body: body, _status: init?.status ?? 200 })),
  },
}));

vi.mock('@/lib/discordAuth', () => ({
  getDiscordSessionUser: vi.fn(),
  hasDiscordAdminRole: vi.fn(),
  resolveTeamFromRoles: vi.fn(),
  resolveDivisionFromRoles: vi.fn(),
}));

const {
  getDiscordSessionUser,
  hasDiscordAdminRole,
  resolveTeamFromRoles,
  resolveDivisionFromRoles,
} = await import('@/lib/discordAuth');
const { GET } = await import('@/app/api/auth/discord/me/route');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeReq() {
  return { headers: { get: () => null } };
}

function unwrap(res) {
  return { status: res._status, body: res._body };
}

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  getDiscordSessionUser.mockReturnValue(null);
  hasDiscordAdminRole.mockReturnValue(false);
  resolveTeamFromRoles.mockReturnValue(null);
  resolveDivisionFromRoles.mockReturnValue(null);
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('GET /api/auth/discord/me', () => {
  it('returns 401 when no Discord session', async () => {
    const res = await GET(makeReq());
    expect(unwrap(res).status).toBe(401);
    expect(unwrap(res).body.error).toBe('Not authenticated');
  });

  it('returns user info with divisionId for a Hospice captain', async () => {
    getDiscordSessionUser.mockReturnValue({
      discordId: 'user-1',
      username: 'HospiceCaptain',
      roles: ['hospice-captain-role', 'team-role'],
    });
    hasDiscordAdminRole.mockReturnValue(false);
    resolveTeamFromRoles.mockReturnValue('team-galactic-stingers');
    resolveDivisionFromRoles.mockReturnValue('div-s9-hospice');

    const res = await GET(makeReq());
    expect(unwrap(res).status).toBe(200);
    const body = unwrap(res).body;
    expect(body.discordId).toBe('user-1');
    expect(body.username).toBe('HospiceCaptain');
    expect(body.isAdmin).toBe(false);
    expect(body.teamId).toBe('team-galactic-stingers');
    expect(body.divisionId).toBe('div-s9-hospice');
  });

  it('returns divisionId for a Rehabilitation captain', async () => {
    getDiscordSessionUser.mockReturnValue({
      discordId: 'user-2',
      username: 'RehabCaptain',
      roles: ['rehab-captain-role', 'team-role-2'],
    });
    hasDiscordAdminRole.mockReturnValue(false);
    resolveTeamFromRoles.mockReturnValue('team-rehab-wolves');
    resolveDivisionFromRoles.mockReturnValue('div-s9-rehabilitation');

    const res = await GET(makeReq());
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body.divisionId).toBe('div-s9-rehabilitation');
    expect(unwrap(res).body.teamId).toBe('team-rehab-wolves');
  });

  it('returns null divisionId for admin without division roles', async () => {
    getDiscordSessionUser.mockReturnValue({
      discordId: 'admin-1',
      username: 'AdminUser',
      roles: ['admin-role'],
    });
    hasDiscordAdminRole.mockReturnValue(true);
    resolveTeamFromRoles.mockReturnValue(null);
    resolveDivisionFromRoles.mockReturnValue(null);

    const res = await GET(makeReq());
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body.isAdmin).toBe(true);
    expect(unwrap(res).body.teamId).toBeNull();
    expect(unwrap(res).body.divisionId).toBeNull();
  });

  it('includes divisionId key in response even when null', async () => {
    getDiscordSessionUser.mockReturnValue({
      discordId: 'user-3',
      username: 'Spectator',
      roles: [],
    });
    resolveDivisionFromRoles.mockReturnValue(null);

    const res = await GET(makeReq());
    expect(unwrap(res).status).toBe(200);
    expect('divisionId' in unwrap(res).body).toBe(true);
    expect(unwrap(res).body.divisionId).toBeNull();
  });
});
