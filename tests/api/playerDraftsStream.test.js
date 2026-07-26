/**
 * Smoke tests for GET /api/player-drafts/[id]/stream — Server-Sent Events.
 *
 * Same shape as app/api/drafts/[id]/stream/route.js: `GET` synchronously
 * returns a `Response` wrapping a `ReadableStream` before any of its
 * `async start()` body runs (streams only start executing up to their first
 * `await`, deferred after that), so the HTTP-level response never depends on
 * whether the draft actually exists. We only assert on what's true
 * synchronously -- the SSE Content-Type header and that construction never
 * throws -- for both a valid and a nonexistent draft id, without trying to
 * drive the internal setInterval poll loop.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock @/lib/playerDraftState ─────────────────────────────────────────────
vi.mock('@/lib/playerDraftState', () => ({
  buildPlayerDraftState: vi.fn(),
}));

const { buildPlayerDraftState } = await import('@/lib/playerDraftState');
const { GET } = await import('@/app/api/player-drafts/[id]/stream/route.js');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/player-drafts/[id]/stream', () => {
  it('returns a text/event-stream Response without throwing for a valid draft id', async () => {
    buildPlayerDraftState.mockResolvedValue({ draft: { version: 1 } });

    const res = await GET({}, { params: { id: 'draft-1' } });

    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    expect(res.headers.get('Connection')).toBe('keep-alive');
    expect(res.body).toBeInstanceOf(ReadableStream);

    // Let the stream's internal `start()` reach its first await, then cancel
    // so the setInterval poll loop doesn't keep running past this test.
    await Promise.resolve();
    await res.body.cancel();
  });

  it('returns the same text/event-stream Response without throwing for a nonexistent draft id', async () => {
    buildPlayerDraftState.mockResolvedValue(null);

    const res = await GET({}, { params: { id: 'does-not-exist' } });

    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    expect(res.body).toBeInstanceOf(ReadableStream);

    await Promise.resolve();
    await res.body.cancel();
  });
});
