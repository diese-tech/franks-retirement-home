/**
 * API tests for POST /api/matches/[id]/games/[gameId]/draft
 * Admin action: create (or return existing) match-bound Draft for a specific game.
 * Idempotent — returns 200 with the existing draft if one already exists.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { unwrap } from './_helpers.js';

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({ _body: body, _status: init?.status ?? 200 })),
  },
}));

vi.mock('@/lib/resolveAuth', () => ({
  resolveAdminAuth: vi.fn(() => ({ _body: { error: 'Unauthorized' }, _status: 401 })),
}));

vi.mock('@/lib/matchDraftProvisioning', () => ({
  buildDraftForGame: vi.fn(),
}));

const { resolveAdminAuth } = await import('@/lib/resolveAuth');
const { buildDraftForGame } = await import('@/lib/matchDraftProvisioning');
const { POST } = await import('@/app/api/matches/[id]/games/[gameId]/draft/route.js');

const MATCH_ID = 'match-1';
const GAME_ID = 'game-1';
const PARAMS = { params: Promise.resolve({ id: MATCH_ID, gameId: GAME_ID }) };

beforeEach(() => {
  vi.clearAllMocks();
  resolveAdminAuth.mockResolvedValue(null);
});

describe('POST /api/matches/[id]/games/[gameId]/draft', () => {
  it('returns the admin auth error when not authorized', async () => {
    resolveAdminAuth.mockResolvedValue({ _body: { error: 'Unauthorized' }, _status: 401 });
    const res = await POST({}, PARAMS);
    expect(unwrap(res).status).toBe(401);
  });

  it('returns 200 with the existing draft when one is already provisioned', async () => {
    buildDraftForGame.mockResolvedValue({ draft: { id: 'draft-1' }, created: false });
    const res = await POST({}, PARAMS);
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body).toEqual({ id: 'draft-1' });
    expect(buildDraftForGame).toHaveBeenCalledWith(MATCH_ID, GAME_ID);
  });

  it('returns 201 with a newly created draft', async () => {
    buildDraftForGame.mockResolvedValue({ draft: { id: 'draft-2' }, created: true });
    const res = await POST({}, PARAMS);
    expect(unwrap(res).status).toBe(201);
    expect(unwrap(res).body).toEqual({ id: 'draft-2' });
  });

  it('returns 404 when the match or game is not found', async () => {
    buildDraftForGame.mockRejectedValue(new Error(`Game ${GAME_ID} not found on match ${MATCH_ID}`));
    const res = await POST({}, PARAMS);
    expect(unwrap(res).status).toBe(404);
  });

  it('returns 500 for unexpected errors', async () => {
    buildDraftForGame.mockRejectedValue(new Error('unexpected failure'));
    const res = await POST({}, PARAMS);
    expect(unwrap(res).status).toBe(500);
  });
});
