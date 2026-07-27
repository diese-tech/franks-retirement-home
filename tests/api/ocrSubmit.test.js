/**
 * API tests for POST /api/ocr/[id]/submit
 * Admin: approve an OCR extraction and write canonical StatLine rows.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeReq, makeInvalidJsonReq, unwrap } from './_helpers.js';

// ─── Mock next/server ────────────────────────────────────────────────────────
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({ _body: body, _status: init?.status ?? 200 })),
  },
}));

// ─── Mock @/lib/resolveAuth ──────────────────────────────────────────────────
vi.mock('@/lib/resolveAuth', () => ({
  resolveAdminAuth: vi.fn(async () => null),
}));

// ─── Mock @/lib/audit ────────────────────────────────────────────────────────
vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn(),
}));

// ─── Mock @/lib/db ───────────────────────────────────────────────────────────
vi.mock('@/lib/db', () => {
  const tx = {
    extractedStatLine: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    statLine: { upsert: vi.fn() },
    game: { update: vi.fn() },
  };
  const prisma = {
    ocrExtraction: { findUnique: vi.fn() },
    $transaction: vi.fn((fn) => fn(tx)),
    _tx: tx,
  };
  return { default: prisma };
});

const { default: prisma } = await import('@/lib/db');
const { resolveAdminAuth } = await import('@/lib/resolveAuth');
const { logAudit } = await import('@/lib/audit');
const { POST } = await import('@/app/api/ocr/[id]/submit/route.js');

const tx = prisma._tx;
const PARAMS = { params: { id: 'ext-1' } };

const HOME_ID = 'home-team';
const AWAY_ID = 'away-team';

const EXTRACTION = {
  id: 'ext-1',
  gameId: 'game-1',
  game: {
    match: { homeTeamId: HOME_ID, awayTeamId: AWAY_ID },
  },
};

const VALID_BODY = {
  orderTeamId: HOME_ID,
  winnerTeamId: HOME_ID,
  rows: [
    { id: 'row-1', resolvedPlayerId: 'player-1', resolvedGodId: 'god-1', kills: 10, deaths: 2, assists: 8, include: true },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  resolveAdminAuth.mockResolvedValue(null);
  prisma.ocrExtraction.findUnique.mockResolvedValue(EXTRACTION);
  prisma.$transaction.mockImplementation((fn) => fn(tx));
  tx.extractedStatLine.findUnique.mockResolvedValue({ id: 'row-1', teamRaw: 'order' });
});

describe('POST /api/ocr/[id]/submit', () => {
  it('returns 401 (admin guard response) when not authorized', async () => {
    const guard = { _body: { error: 'Unauthorized' }, _status: 401 };
    resolveAdminAuth.mockResolvedValue(guard);
    const res = await POST(makeReq(VALID_BODY), PARAMS);
    expect(res).toBe(guard);
  });

  it('returns 400 for invalid JSON', async () => {
    const res = await POST(makeInvalidJsonReq(), PARAMS);
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 400 when orderTeamId is missing', async () => {
    const res = await POST(makeReq({ ...VALID_BODY, orderTeamId: undefined }), PARAMS);
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/orderTeamId/i);
  });

  it('returns 400 when winnerTeamId is missing', async () => {
    const res = await POST(makeReq({ ...VALID_BODY, winnerTeamId: undefined }), PARAMS);
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/winnerTeamId/i);
  });

  it('returns 400 when rows is missing or empty', async () => {
    const res = await POST(makeReq({ ...VALID_BODY, rows: [] }), PARAMS);
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/rows is required/i);
  });

  it('returns 404 when the extraction does not exist', async () => {
    prisma.ocrExtraction.findUnique.mockResolvedValue(null);
    const res = await POST(makeReq(VALID_BODY), PARAMS);
    expect(unwrap(res).status).toBe(404);
  });

  it('returns 400 when the extraction has no linked game', async () => {
    prisma.ocrExtraction.findUnique.mockResolvedValue({ ...EXTRACTION, gameId: null });
    const res = await POST(makeReq(VALID_BODY), PARAMS);
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/not linked to a game/i);
  });

  it('returns 400 when an included row has no resolved player', async () => {
    const res = await POST(
      makeReq({ ...VALID_BODY, rows: [{ id: 'row-1', resolvedPlayerId: null, include: true }] }),
      PARAMS,
    );
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/no player assigned/i);
  });

  it('writes StatLine rows and marks the extraction row approved', async () => {
    const res = await POST(makeReq(VALID_BODY), PARAMS);
    expect(unwrap(res).status).toBe(200);
    expect(tx.statLine.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { gameId_playerId: { gameId: 'game-1', playerId: 'player-1' } },
        create: expect.objectContaining({ teamId: HOME_ID, godId: 'god-1', kills: 10 }),
      }),
    );
    expect(tx.extractedStatLine.update).toHaveBeenCalledWith({
      where: { id: 'row-1' },
      data: { status: 'approved', resolvedPlayerId: 'player-1', resolvedGodId: 'god-1' },
    });
    expect(tx.game.update).toHaveBeenCalledWith({
      where: { id: 'game-1' },
      data: { winnerTeamId: HOME_ID },
    });
    expect(logAudit).toHaveBeenCalledWith('OcrExtraction', 'ext-1', 'submitted', expect.any(Object));
  });

  it('assigns the chaos team when the extracted row side is not "order"', async () => {
    tx.extractedStatLine.findUnique.mockResolvedValue({ id: 'row-1', teamRaw: 'chaos' });
    await POST(makeReq(VALID_BODY), PARAMS);
    expect(tx.statLine.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ teamId: AWAY_ID }) }),
    );
  });

  it('rejects excluded rows via a bulk updateMany', async () => {
    const body = {
      ...VALID_BODY,
      rows: [
        ...VALID_BODY.rows,
        { id: 'row-2', include: false },
      ],
    };
    await POST(makeReq(body), PARAMS);
    expect(tx.extractedStatLine.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['row-2'] } },
      data: { status: 'rejected', rejectionReason: 'excluded by admin' },
    });
  });

  it('returns 500 (and reports to Sentry) when the transaction throws', async () => {
    prisma.$transaction.mockRejectedValue(new Error('db exploded'));
    const res = await POST(makeReq(VALID_BODY), PARAMS);
    expect(unwrap(res).status).toBe(500);
    expect(unwrap(res).body.error).toMatch(/Failed to submit OCR extraction/i);
    expect(logAudit).not.toHaveBeenCalled();
  });
});
