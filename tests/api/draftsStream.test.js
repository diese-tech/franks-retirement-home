/**
 * Smoke tests for GET /api/drafts/[id]/stream — Server-Sent Events.
 *
 * This route never returns an HTTP 404: it always synchronously returns a
 * `Response` wrapping a `ReadableStream`, and only emits a `{ type:
 * 'not_found' }` SSE frame *inside* the stream (asynchronously, via a 1.5s
 * poll loop) once the DB lookup resolves. That means there's no HTTP-level
 * status to assert on for a missing draft -- the only thing worth pinning
 * down at the unit level, without driving fake timers or racing the async
 * poll loop, is that constructing the Response never throws and always
 * carries the SSE Content-Type header, for both a valid and a nonexistent
 * draft id.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock @/lib/db ───────────────────────────────────────────────────────────
vi.mock('@/lib/db', () => {
  const prisma = {
    draft: { findUnique: vi.fn() },
  };
  return { default: prisma };
});

// ─── Mock @/lib/draftState ───────────────────────────────────────────────────
vi.mock('@/lib/draftState', () => ({
  buildDraftState: vi.fn(),
  buildChatPayload: vi.fn(),
}));

const { default: prisma } = await import('@/lib/db');
const { GET } = await import('@/app/api/drafts/[id]/stream/route.js');

function makeStreamReq() {
  const controller = new AbortController();
  return { signal: controller.signal, abort: () => controller.abort() };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/drafts/[id]/stream', () => {
  it('returns a text/event-stream Response without throwing for a valid draft id', async () => {
    prisma.draft.findUnique.mockResolvedValue({ version: 1, chatsVersion: 1 });
    const req = makeStreamReq();

    const res = await GET(req, { params: Promise.resolve({ id: 'draft-1' }) });

    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    expect(res.headers.get('Cache-Control')).toMatch(/no-cache/);
    expect(res.body).toBeInstanceOf(ReadableStream);

    // Stop the background poll loop so it doesn't keep running after the test.
    req.abort();
  });

  it('returns the same text/event-stream Response without throwing for a nonexistent draft id', async () => {
    prisma.draft.findUnique.mockResolvedValue(null);
    const req = makeStreamReq();

    const res = await GET(req, { params: Promise.resolve({ id: 'does-not-exist' }) });

    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    expect(res.body).toBeInstanceOf(ReadableStream);

    req.abort();
  });
});
