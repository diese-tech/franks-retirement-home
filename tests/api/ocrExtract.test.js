/**
 * API tests for POST /api/ocr/extract
 *
 * Accepts either an admin session cookie OR a valid X-Captain-Key for the
 * match. The route calls out to Gemini (lib/gemini.extractSmite2Details) to
 * OCR the screenshot -- that call is mocked so no real network/model call
 * is ever made from tests.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeReq, makeInvalidJsonReq, unwrap } from './_helpers.js';

// ─── Mock next/server ────────────────────────────────────────────────────────
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({ _body: body, _status: init?.status ?? 200 })),
  },
}));

// ─── Mock @/lib/adminSession ─────────────────────────────────────────────────
vi.mock('@/lib/adminSession', () => ({
  requireAdmin: vi.fn(() => ({ _body: { error: 'Unauthorized' }, _status: 401 })), // not admin by default
}));

// ─── Mock @/lib/resolveAuth ──────────────────────────────────────────────────
vi.mock('@/lib/resolveAuth', () => ({
  resolveMatchCaptainAuth: vi.fn(async () => ({ side: null, isAdmin: false })),
}));

// ─── Mock @/lib/matchWindow ──────────────────────────────────────────────────
vi.mock('@/lib/matchWindow', () => ({
  checkMatchWindow: vi.fn(() => ({ ok: true })),
}));

// ─── Mock @/lib/rateLimit ────────────────────────────────────────────────────
vi.mock('@/lib/rateLimit', () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true })),
  clientIp: vi.fn(() => '1.2.3.4'),
}));

// ─── Mock @/lib/audit ────────────────────────────────────────────────────────
vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn(),
}));

// ─── Mock @/lib/gemini — never hit the real Gemini API from tests ───────────
vi.mock('@/lib/gemini', () => ({
  extractSmite2Details: vi.fn(),
}));

// ─── Mock @/lib/db ───────────────────────────────────────────────────────────
vi.mock('@/lib/db', () => {
  const tx = {
    teamMember: { findMany: vi.fn() },
    extractedStatLine: { create: vi.fn() },
    ocrExtraction: { update: vi.fn() },
  };
  const prisma = {
    game: { findUnique: vi.fn() },
    god: { findMany: vi.fn() },
    ocrExtraction: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
    $transaction: vi.fn((fn) => fn(tx)),
    _tx: tx,
  };
  return { default: prisma };
});

const { default: prisma } = await import('@/lib/db');
const { requireAdmin } = await import('@/lib/adminSession');
const { resolveMatchCaptainAuth } = await import('@/lib/resolveAuth');
const { checkMatchWindow } = await import('@/lib/matchWindow');
const { checkRateLimit } = await import('@/lib/rateLimit');
const { logAudit } = await import('@/lib/audit');
const { extractSmite2Details } = await import('@/lib/gemini');
const { POST } = await import('@/app/api/ocr/extract/route.js');

const tx = prisma._tx;
const HOME_ID = 'home-team';
const AWAY_ID = 'away-team';

const GAME = {
  id: 'game-1',
  match: {
    homeTeamId: HOME_ID,
    awayTeamId: AWAY_ID,
    homeTeam: { id: HOME_ID, name: 'Home', tag: 'HT' },
    awayTeam: { id: AWAY_ID, name: 'Away', tag: 'AT' },
  },
};

const VALID_BODY = { gameId: 'game-1', imageBase64: 'ZmFrZQ==' };

const GEMINI_RESULT = {
  players: [
    { ign: 'Cap', god: 'Zeus', side: 'order', kills: 10, deaths: 2, assists: 8, playerDamage: 50000, damageMitigated: 100, selfHealing: 10, allyHealing: 5, structureDamage: 200 },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GEMINI_API_KEY = 'test-key';
  requireAdmin.mockReturnValue(null); // admin authorized by default
  prisma.game.findUnique.mockResolvedValue(GAME);
  prisma.god.findMany.mockResolvedValue([{ id: 'god-1', name: 'Zeus' }]);
  prisma.ocrExtraction.create.mockResolvedValue({ id: 'ext-1' });
  prisma.ocrExtraction.findUnique.mockResolvedValue({ id: 'ext-1', rows: [] });
  prisma.$transaction.mockImplementation((fn) => fn(tx));
  tx.teamMember.findMany.mockResolvedValue([
    { teamId: HOME_ID, playerId: 'player-1', player: { id: 'player-1', name: 'Cap', discordUsername: 'cap#0001', aliases: [] } },
  ]);
  extractSmite2Details.mockResolvedValue(GEMINI_RESULT);
  // Reset return values explicitly -- vi.clearAllMocks() clears call history
  // but not a previously set mockReturnValue/mockResolvedValue, so tests that
  // override these must not leak into later tests.
  checkMatchWindow.mockReturnValue({ ok: true });
  checkRateLimit.mockResolvedValue({ allowed: true });
});

afterEach(() => {
  delete process.env.GEMINI_API_KEY;
});

describe('POST /api/ocr/extract', () => {
  it('returns 503 when GEMINI_API_KEY is not configured', async () => {
    delete process.env.GEMINI_API_KEY;
    const res = await POST(makeReq(VALID_BODY));
    expect(unwrap(res).status).toBe(503);
    expect(extractSmite2Details).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid JSON', async () => {
    const res = await POST(makeInvalidJsonReq());
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 400 when gameId is missing', async () => {
    const res = await POST(makeReq({ imageBase64: 'x' }));
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/gameId is required/i);
  });

  it('returns 400 when imageBase64 is missing', async () => {
    const res = await POST(makeReq({ gameId: 'game-1' }));
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/imageBase64 is required/i);
  });

  it('returns 404 when the game does not exist', async () => {
    prisma.game.findUnique.mockResolvedValue(null);
    const res = await POST(makeReq(VALID_BODY));
    expect(unwrap(res).status).toBe(404);
  });

  it('returns the original 401 when neither admin nor captain auth resolves', async () => {
    requireAdmin.mockReturnValue({ _body: { error: 'Unauthorized' }, _status: 401 });
    resolveMatchCaptainAuth.mockResolvedValue({ side: null, isAdmin: false });
    const res = await POST(makeReq(VALID_BODY));
    expect(unwrap(res).status).toBe(401);
    expect(extractSmite2Details).not.toHaveBeenCalled();
  });

  it('admin path: returns the full extraction result', async () => {
    const res = await POST(makeReq(VALID_BODY));
    expect(unwrap(res).status).toBe(201);
    expect(unwrap(res).body).toEqual({ id: 'ext-1', rows: [] });
    expect(logAudit).toHaveBeenCalledWith('OcrExtraction', 'ext-1', 'extracted', expect.any(Object));
  });

  it('captain path: is subject to the match eligibility window', async () => {
    requireAdmin.mockReturnValue({ _body: { error: 'Unauthorized' }, _status: 401 });
    resolveMatchCaptainAuth.mockResolvedValue({ side: 'home', isAdmin: false });
    checkMatchWindow.mockReturnValue({ ok: false, reason: 'Match actions are not yet available.' });

    const res = await POST(makeReq(VALID_BODY));
    expect(unwrap(res).status).toBe(403);
    expect(extractSmite2Details).not.toHaveBeenCalled();
  });

  it('captain path: is rate limited (6 per 10 minutes)', async () => {
    requireAdmin.mockReturnValue({ _body: { error: 'Unauthorized' }, _status: 401 });
    resolveMatchCaptainAuth.mockResolvedValue({ side: 'home', isAdmin: false });
    checkRateLimit.mockResolvedValue({ allowed: false });

    const res = await POST(makeReq(VALID_BODY));
    expect(unwrap(res).status).toBe(429);
    expect(checkRateLimit).toHaveBeenCalledWith('ocr-extract:1.2.3.4', 6, 600);
  });

  it('captain path: returns only a confirmation, no extracted data', async () => {
    requireAdmin.mockReturnValue({ _body: { error: 'Unauthorized' }, _status: 401 });
    resolveMatchCaptainAuth.mockResolvedValue({ side: 'home', isAdmin: false });

    const res = await POST(makeReq(VALID_BODY));
    expect(unwrap(res).status).toBe(201);
    expect(unwrap(res).body).toEqual({ ok: true, extractionId: 'ext-1' });
  });

  it('creates one ExtractedStatLine per player with auto-resolved god and player', async () => {
    await POST(makeReq(VALID_BODY));
    expect(tx.extractedStatLine.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ignRaw: 'Cap',
        godRaw: 'Zeus',
        resolvedGodId: 'god-1',
        resolvedPlayerId: 'player-1',
        kills: 10,
        deaths: 2,
        assists: 8,
        status: 'pending',
      }),
    });
  });

  it('clamps out-of-range stat values instead of persisting them raw', async () => {
    extractSmite2Details.mockResolvedValue({
      players: [{ ign: 'Cap', god: 'Zeus', side: 'order', kills: 99999, deaths: 2, assists: 8, playerDamage: -5, damageMitigated: 0, selfHealing: 0, allyHealing: 0, structureDamage: 0 }],
    });
    await POST(makeReq(VALID_BODY));
    expect(tx.extractedStatLine.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ kills: 100, damageDealt: 0 }),
    });
  });

  it('returns 502 and marks the extraction failed when Gemini throws', async () => {
    extractSmite2Details.mockRejectedValue(new Error('model unavailable'));
    prisma.ocrExtraction.update.mockResolvedValue({});
    const res = await POST(makeReq(VALID_BODY));
    expect(unwrap(res).status).toBe(502);
    expect(unwrap(res).body.error).toMatch(/Extraction failed/i);
    expect(prisma.ocrExtraction.update).toHaveBeenCalledWith({
      where: { id: 'ext-1' },
      data: expect.objectContaining({ status: 'failed', errorMessage: 'model unavailable' }),
    });
  });
});
