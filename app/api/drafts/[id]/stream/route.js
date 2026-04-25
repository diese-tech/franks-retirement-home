import prisma from '@/lib/db';
import { buildDraftState } from '@/lib/draftState';

export const dynamic = 'force-dynamic';

// GET /api/drafts/[id]/stream
// SSE endpoint. Polls DB every 1.5s, emits full state on version change.
// EventSource auto-reconnects on disconnect (e.g. Vercel function timeout).
export async function GET(request, { params }) {
  const { id } = await params;
  const encoder = new TextEncoder();
  let closed = false;
  let lastVersion = -1;

  const stream = new ReadableStream({
    start(controller) {
      const send = (obj) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        } catch {
          closed = true;
        }
      };

      const poll = async () => {
        if (closed) return;
        try {
          const row = await prisma.draft.findUnique({
            where: { id },
            select: { version: true },
          });
          if (!row) {
            send({ type: 'not_found' });
            try { controller.close(); } catch {}
            return;
          }
          if (row.version !== lastVersion) {
            lastVersion = row.version;
            const state = await buildDraftState(id);
            if (state) send({ type: 'state', ...state });
          }
        } catch {
          // Swallow poll errors — keep the stream alive
        }
        if (!closed) setTimeout(poll, 1500);
      };

      request.signal.addEventListener('abort', () => {
        closed = true;
        try { controller.close(); } catch {}
      });

      poll();
    },
    cancel() { closed = true; },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
