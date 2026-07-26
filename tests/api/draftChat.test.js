/**
 * API tests for POST /api/drafts/[id]/chat
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeReq, makeInvalidJsonReq, unwrap } from './_helpers.js';

// ─── Mock next/server ────────────────────────────────────────────────────────
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({ _body: body, _status: init?.status ?? 200 })),
  },
}));

// ─── Mock @/lib/db ───────────────────────────────────────────────────────────
vi.mock('@/lib/db', () => {
  const prisma = {
    draft: { findUnique: vi.fn(), update: vi.fn() },
    draftChat: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  return { default: prisma };
});

// ─── Mock @/lib/draftAuth ────────────────────────────────────────────────────
vi.mock('@/lib/draftAuth', () => ({
  resolveRole: vi.fn(),
  SENDER_INFO: {
    captainA:  { name: 'Captain Alpha', team: 'A' },
    captainB:  { name: 'Captain Bravo', team: 'B' },
    admin:     { name: 'Admin',         team: 'admin' },
    spectator: { name: 'Spectator',     team: 'spectator' },
  },
}));

// ─── Mock @/lib/rateLimit ────────────────────────────────────────────────────
vi.mock('@/lib/rateLimit', () => ({
  clientIp: vi.fn(() => '1.2.3.4'),
  consume: vi.fn(() => true),
}));

function reqWithHeaders(body) {
  return {
    json: () => Promise.resolve(body),
    headers: { get: () => null },
  };
}

const { default: prisma } = await import('@/lib/db');
const { resolveRole } = await import('@/lib/draftAuth');
const { consume } = await import('@/lib/rateLimit');
const { POST } = await import('@/app/api/drafts/[id]/chat/route.js');

const DRAFT_ID = 'draft-chat-1';
const PARAMS = { params: Promise.resolve({ id: DRAFT_ID }) };
const MOCK_DRAFT = { id: DRAFT_ID, status: 'lobby' };

beforeEach(() => {
  vi.clearAllMocks();
  consume.mockReturnValue(true);
  prisma.draft.findUnique.mockResolvedValue(MOCK_DRAFT);
  prisma.draft.update.mockResolvedValue({});
  prisma.draftChat.create.mockResolvedValue({});
  prisma.$transaction.mockResolvedValue([]);
  resolveRole.mockReturnValue('spectator');
});

describe('POST /api/drafts/[id]/chat', () => {
  it('returns 429 when rate limited', async () => {
    consume.mockReturnValue(false);
    const res = await POST(reqWithHeaders({ message: 'hi' }), PARAMS);
    expect(unwrap(res).status).toBe(429);
  });

  it('returns 400 for invalid JSON', async () => {
    const req = { json: () => { throw new SyntaxError('bad'); }, headers: { get: () => null } };
    const res = await POST(req, PARAMS);
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 400 when message is missing or blank', async () => {
    const res = await POST(reqWithHeaders({ message: '   ' }), PARAMS);
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/message required/i);
  });

  it('truncates messages longer than the max length', async () => {
    const longMessage = 'a'.repeat(600);
    let capturedMessage;
    prisma.$transaction.mockImplementation((ops) => {
      capturedMessage = ops;
      return Promise.resolve([]);
    });
    const res = await POST(reqWithHeaders({ message: longMessage }), PARAMS);
    expect(unwrap(res).status).toBe(200);
    expect(capturedMessage).toBeDefined();
  });

  it('returns 404 when draft does not exist', async () => {
    prisma.draft.findUnique.mockResolvedValue(null);
    const res = await POST(reqWithHeaders({ message: 'hi' }), PARAMS);
    expect(unwrap(res).status).toBe(404);
  });

  it('returns 400 when draft is pending (chat not open yet)', async () => {
    prisma.draft.findUnique.mockResolvedValue({ ...MOCK_DRAFT, status: 'pending' });
    const res = await POST(reqWithHeaders({ message: 'hi' }), PARAMS);
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/lobby opens/i);
  });

  it('allows spectators to chat', async () => {
    resolveRole.mockReturnValue('spectator');
    const res = await POST(reqWithHeaders({ message: 'hi all' }), PARAMS);
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body.ok).toBe(true);
  });

  it('records the chat for a captain and bumps chatsVersion', async () => {
    resolveRole.mockReturnValue('captainA');
    const res = await POST(reqWithHeaders({ key: 'cap-a-key', message: 'gl hf' }), PARAMS);
    expect(unwrap(res).status).toBe(200);
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('returns 500 on unexpected error', async () => {
    prisma.$transaction.mockRejectedValue(new Error('db down'));
    const res = await POST(reqWithHeaders({ message: 'hi' }), PARAMS);
    expect(unwrap(res).status).toBe(500);
  });
});
