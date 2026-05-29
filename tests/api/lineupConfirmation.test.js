/**
 * API tests for PATCH /api/drafts/[id]/picks/[pickId]
 * (Lineup Confirmation — assign a player to a draft slot after draft completes)
 *
 * Focus: the route now uses resolveDraftCaptainAuth (Discord-first) instead of
 * resolveRole (key-only), so Discord-authenticated captains can confirm lineups
 * without needing the raw key in the request body.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeReq, makeInvalidJsonReq, unwrap } from './_helpers.js';

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({ _body: body, _status: init?.status ?? 200 })),
  },
}));

vi.mock('@/lib/db', () => {
  const prisma = {
    draft: { findUnique: vi.fn() },
    draftPick: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    teamMember: { findUnique: vi.fn() },
  };
  return { default: prisma };
});

vi.mock('@/lib/resolveAuth', () => ({
  resolveDraftCaptainAuth: vi.fn(),
}));

const { default: prisma } = await import('@/lib/db');
const { resolveDraftCaptainAuth } = await import('@/lib/resolveAuth');
const { PATCH } = await import('@/app/api/drafts/[id]/picks/[pickId]/route.js');

const DRAFT_ID = 'draft-1';
const PICK_ID  = 'pick-1';
const PARAMS   = { params: { id: DRAFT_ID, pickId: PICK_ID } };

const BASE_DRAFT = {
  id: DRAFT_ID,
  status: 'complete',
  gameId: 'game-1',
  adminKey: 'admin-key',
  captainAKey: 'cap-a-key',
  captainBKey: 'cap-b-key',
  game: { match: { homeTeamId: 'home-team', awayTeamId: 'away-team' } },
};

const BASE_PICK = {
  id: PICK_ID,
  draftId: DRAFT_ID,
  team: 'A',
  playerId: null,
};

const UPDATED_PICK = {
  id: PICK_ID,
  draftId: DRAFT_ID,
  team: 'A',
  playerId: 'player-1',
  player: { id: 'player-1', name: 'Alice', role: 'Mid' },
  god: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  prisma.draft.findUnique.mockResolvedValue(BASE_DRAFT);
  prisma.draftPick.findUnique.mockResolvedValue(BASE_PICK);
  prisma.draftPick.findFirst.mockResolvedValue(null);
  prisma.draftPick.update.mockResolvedValue(UPDATED_PICK);
  prisma.teamMember.findUnique.mockResolvedValue({ id: 'mem-1' });
  resolveDraftCaptainAuth.mockResolvedValue({ role: 'captainA', source: 'discord' });
});

describe('PATCH /api/drafts/[id]/picks/[pickId] — lineup confirmation', () => {
  it('returns 400 for invalid JSON', async () => {
    const res = await PATCH(makeInvalidJsonReq(), PARAMS);
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 404 when draft does not exist', async () => {
    prisma.draft.findUnique.mockResolvedValue(null);
    const res = await PATCH(makeReq({ playerId: 'player-1' }), PARAMS);
    expect(unwrap(res).status).toBe(404);
  });

  it('returns 400 when draft is not complete', async () => {
    prisma.draft.findUnique.mockResolvedValue({ ...BASE_DRAFT, status: 'picking' });
    const res = await PATCH(makeReq({ playerId: 'player-1' }), PARAMS);
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/complete/i);
  });

  it('returns 401 when caller is a spectator', async () => {
    resolveDraftCaptainAuth.mockResolvedValue({ role: 'spectator', source: 'discord' });
    const res = await PATCH(makeReq({ playerId: 'player-1' }), PARAMS);
    expect(unwrap(res).status).toBe(401);
  });

  it('passes Discord-authed captain with no body key — uses resolveDraftCaptainAuth', async () => {
    resolveDraftCaptainAuth.mockResolvedValue({ role: 'captainA', source: 'discord' });
    const res = await PATCH(makeReq({ playerId: 'player-1' }), PARAMS);
    expect(unwrap(res).status).toBe(200);
    // Confirm the auth came through resolveDraftCaptainAuth, not a key check
    expect(resolveDraftCaptainAuth).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: DRAFT_ID }),
      undefined, // no key in body
    );
  });

  it('Discord-authed captainA cannot assign to team B slot', async () => {
    resolveDraftCaptainAuth.mockResolvedValue({ role: 'captainA', source: 'discord' });
    prisma.draftPick.findUnique.mockResolvedValue({ ...BASE_PICK, team: 'B' });
    const res = await PATCH(makeReq({ playerId: 'player-1' }), PARAMS);
    expect(unwrap(res).status).toBe(403);
    expect(unwrap(res).body.error).toMatch(/opposing team/i);
  });

  it('admin can assign to either team slot', async () => {
    resolveDraftCaptainAuth.mockResolvedValue({ role: 'admin', source: 'discord' });
    prisma.draftPick.findUnique.mockResolvedValue({ ...BASE_PICK, team: 'B' });
    const res = await PATCH(makeReq({ playerId: 'player-1' }), PARAMS);
    expect(unwrap(res).status).toBe(200);
  });

  it('returns 409 when player is already assigned to another slot', async () => {
    prisma.draftPick.findFirst.mockResolvedValue({ id: 'other-pick' });
    const res = await PATCH(makeReq({ playerId: 'player-1' }), PARAMS);
    expect(unwrap(res).status).toBe(409);
  });

  it('clears a slot when playerId is null', async () => {
    prisma.draftPick.update.mockResolvedValue({ ...UPDATED_PICK, playerId: null, player: null });
    const res = await PATCH(makeReq({ playerId: null }), PARAMS);
    expect(unwrap(res).status).toBe(200);
    expect(prisma.draftPick.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { playerId: null } }),
    );
  });
});
