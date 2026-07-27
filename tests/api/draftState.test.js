/**
 * API tests for GET /api/drafts/[id]/state
 * Mirrors the concern from tests/e2e/draft.spec.js's
 * "draft keys are not exposed in public state response" test, but at the
 * unit level: buildDraftState is responsible for stripping keys, and this
 * route must simply pass its output through untouched (no re-adding keys).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { unwrap } from './_helpers.js';

// ─── Mock next/server ────────────────────────────────────────────────────────
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({ _body: body, _status: init?.status ?? 200 })),
  },
}));

// ─── Mock @/lib/draftState ───────────────────────────────────────────────────
vi.mock('@/lib/draftState', () => ({
  buildDraftState: vi.fn(),
}));

// ─── Mocks for buildDraftState's own dependencies ────────────────────────────
// Only needed for the "real sanitizer" test below, which un-mocks
// buildDraftState itself to prove the key-stripping logic actually works,
// rather than trusting a hand-fed already-sanitized fixture.
vi.mock('@/lib/db', () => ({
  default: {
    draft: { findUnique: vi.fn() },
    draftPick: { findMany: vi.fn() },
    draftBan: { findMany: vi.fn() },
    draftChat: { findMany: vi.fn() },
    game: { findUnique: vi.fn() },
  },
}));
vi.mock('@/lib/referenceData', () => ({
  getPlayers: vi.fn(() => []),
  getGods: vi.fn(() => []),
}));
vi.mock('@/lib/usedGodIds', () => ({
  getEffectiveVaultedGodIds: vi.fn(() => []),
}));

const { buildDraftState } = await import('@/lib/draftState');
const { default: prisma } = await import('@/lib/db');
const { GET } = await import('@/app/api/drafts/[id]/state/route.js');

const DRAFT_ID = 'draft-state-1';
const PARAMS = { params: Promise.resolve({ id: DRAFT_ID }) };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/drafts/[id]/state', () => {
  it('returns 404 when the draft does not exist', async () => {
    buildDraftState.mockResolvedValue(null);
    const res = await GET({}, PARAMS);
    expect(unwrap(res).status).toBe(404);
  });

  it('returns the sanitized state as-is on success', async () => {
    const state = {
      draft: { id: DRAFT_ID, status: 'lobby', usedGodIds: [] },
      picks: [],
      bans: [],
      chats: [],
      players: [],
      gods: [],
    };
    buildDraftState.mockResolvedValue(state);
    const res = await GET({}, PARAMS);
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body).toEqual(state);
  });

  it('never leaks adminKey/captainAKey/captainBKey in the public state response', async () => {
    // Exercises the real buildDraftState (not the mocked stand-in used by the
    // other tests in this file) so this actually catches a regression in the
    // sanitizer itself, rather than trusting an already-sanitized fixture.
    const { buildDraftState: realBuildDraftState } = await vi.importActual('@/lib/draftState');
    buildDraftState.mockImplementation(realBuildDraftState);

    prisma.draft.findUnique.mockResolvedValue({
      id: DRAFT_ID,
      status: 'lobby',
      gameId: null,
      adminKey: 'super-secret-admin-key',
      captainAKey: 'super-secret-captain-a-key',
      captainBKey: 'super-secret-captain-b-key',
    });
    prisma.draftPick.findMany.mockResolvedValue([]);
    prisma.draftBan.findMany.mockResolvedValue([]);
    prisma.draftChat.findMany.mockResolvedValue([]);

    const res = await GET({}, PARAMS);
    const serialized = JSON.stringify(unwrap(res).body);
    expect(serialized).not.toMatch(/super-secret-admin-key/);
    expect(serialized).not.toMatch(/super-secret-captain-a-key/);
    expect(serialized).not.toMatch(/super-secret-captain-b-key/);
    expect(serialized).not.toMatch(/adminKey/i);
    expect(serialized).not.toMatch(/captainAKey/i);
    expect(serialized).not.toMatch(/captainBKey/i);
  });

  it('calls buildDraftState with the resolved draft id', async () => {
    buildDraftState.mockResolvedValue({ draft: {} });
    await GET({}, PARAMS);
    expect(buildDraftState).toHaveBeenCalledWith(DRAFT_ID);
  });

  it('returns 500 when buildDraftState throws', async () => {
    buildDraftState.mockRejectedValue(new Error('db down'));
    const res = await GET({}, PARAMS);
    expect(unwrap(res).status).toBe(500);
  });
});
