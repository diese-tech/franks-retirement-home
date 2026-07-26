/**
 * API tests for /api/matches/[id]/submissions
 *   GET  — admin: list all submissions for a match
 *   POST — captain-key gated (or admin bypass): create a submission
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { unwrap } from './_helpers.js';

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({ _body: body, _status: init?.status ?? 200 })),
  },
}));

vi.mock('@/lib/db', () => {
  const prisma = {
    match: { findUnique: vi.fn() },
    matchSubmission: { findMany: vi.fn(), create: vi.fn() },
  };
  return { default: prisma };
});

vi.mock('@/lib/resolveAuth', () => ({
  resolveAdminAuth: vi.fn(() => ({ _body: { error: 'Unauthorized' }, _status: 401 })),
  resolveMatchCaptainAuth: vi.fn(() => ({ side: null, source: null, isAdmin: false })),
}));

vi.mock('@/lib/matchWindow', () => ({
  checkMatchWindow: vi.fn(() => ({ ok: true })),
}));

const { default: prisma } = await import('@/lib/db');
const { resolveAdminAuth, resolveMatchCaptainAuth } = await import('@/lib/resolveAuth');
const { checkMatchWindow } = await import('@/lib/matchWindow');
const { GET, POST } = await import('@/app/api/matches/[id]/submissions/route.js');

const MATCH_ID = 'match-1';
const PARAMS = { params: { id: MATCH_ID } };

const BASE_MATCH = {
  id: MATCH_ID,
  homeTeamCaptainKey: 'home-key',
  awayTeamCaptainKey: 'away-key',
  status: 'live',
  defaultScheduledAt: null,
};

function makeSubmissionReq(body) {
  return { json: () => Promise.resolve(body) };
}

beforeEach(() => {
  vi.clearAllMocks();
  resolveAdminAuth.mockResolvedValue({ _body: { error: 'Unauthorized' }, _status: 401 }); // not admin by default
  resolveMatchCaptainAuth.mockResolvedValue({ side: 'home', source: 'key', isAdmin: false });
  checkMatchWindow.mockReturnValue({ ok: true });
  prisma.match.findUnique.mockResolvedValue(BASE_MATCH);
});

describe('GET /api/matches/[id]/submissions', () => {
  it('returns the admin auth error when not authorized', async () => {
    const res = await GET({}, PARAMS);
    expect(unwrap(res).status).toBe(401);
  });

  it('returns submissions for the match', async () => {
    resolveAdminAuth.mockResolvedValue(null);
    prisma.matchSubmission.findMany.mockResolvedValue([{ id: 'sub-1' }]);
    const res = await GET({}, PARAMS);
    expect(unwrap(res).status).toBe(200);
    expect(prisma.matchSubmission.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { matchId: MATCH_ID },
    }));
  });

  it('returns 500 when the query fails', async () => {
    resolveAdminAuth.mockResolvedValue(null);
    prisma.matchSubmission.findMany.mockRejectedValue(new Error('db down'));
    const res = await GET({}, PARAMS);
    expect(unwrap(res).status).toBe(500);
  });
});

describe('POST /api/matches/[id]/submissions', () => {
  it('returns 400 when the body is not valid JSON', async () => {
    const req = { json: () => Promise.reject(new SyntaxError('bad json')) };
    const res = await POST(req, PARAMS);
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 404 when the match does not exist', async () => {
    prisma.match.findUnique.mockResolvedValue(null);
    const res = await POST(makeSubmissionReq({}), PARAMS);
    expect(unwrap(res).status).toBe(404);
  });

  it('returns 401 when neither admin nor captain', async () => {
    resolveMatchCaptainAuth.mockResolvedValue({ side: null, source: null, isAdmin: false });
    const res = await POST(makeSubmissionReq({}), PARAMS);
    expect(unwrap(res).status).toBe(401);
  });

  it('returns 403 when a captain submits outside the eligibility window', async () => {
    checkMatchWindow.mockReturnValue({ ok: false, reason: 'window closed' });
    const res = await POST(makeSubmissionReq({}), PARAMS);
    expect(unwrap(res).status).toBe(403);
    expect(unwrap(res).body.error).toMatch(/window closed/);
  });

  it('returns 400 when attachments exceed the max count', async () => {
    const attachments = Array.from({ length: 11 }, (_, i) => ({ url: `https://example.com/${i}.png` }));
    const res = await POST(makeSubmissionReq({ attachments }), PARAMS);
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 400 for an invalid attachment url', async () => {
    const res = await POST(makeSubmissionReq({ attachments: [{ url: 'not-a-url' }] }), PARAMS);
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 400 when notes exceed the max length', async () => {
    const res = await POST(makeSubmissionReq({ notes: 'x'.repeat(2001) }), PARAMS);
    expect(unwrap(res).status).toBe(400);
  });

  it('creates a submission for a captain within the eligibility window', async () => {
    prisma.matchSubmission.create.mockResolvedValue({ id: 'sub-1' });
    const res = await POST(
      makeSubmissionReq({ notes: 'hello', attachments: [{ url: 'https://example.com/a.png' }] }),
      PARAMS,
    );
    expect(unwrap(res).status).toBe(201);
    expect(prisma.matchSubmission.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ matchId: MATCH_ID, notes: 'hello' }),
    }));
  });

  it('allows an admin to submit without a captain key and bypasses the window check', async () => {
    resolveAdminAuth.mockResolvedValue(null);
    resolveMatchCaptainAuth.mockResolvedValue({ side: null, source: null, isAdmin: false });
    checkMatchWindow.mockReturnValue({ ok: false, reason: 'window closed' });
    prisma.matchSubmission.create.mockResolvedValue({ id: 'sub-2' });
    const res = await POST(makeSubmissionReq({}), PARAMS);
    expect(unwrap(res).status).toBe(201);
    expect(checkMatchWindow).not.toHaveBeenCalled();
  });

  it('returns 500 when creation fails', async () => {
    prisma.matchSubmission.create.mockRejectedValue(new Error('db down'));
    const res = await POST(makeSubmissionReq({}), PARAMS);
    expect(unwrap(res).status).toBe(500);
  });
});
