import { buildPlayerDraftState } from '@/lib/playerDraftState';

export const dynamic = 'force-dynamic';

// GET /api/player-drafts/[id]/stream
// SSE stream — same version-polling pattern as /api/drafts/[id]/stream.
// Polls DB every 2s; sends 'state' event when version changes.
export async function GET(_req, { params }) {
  let closed = false;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event, data) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {}
      };

      // Send initial state
      const initial = await buildPlayerDraftState(params.id);
      if (!initial) {
        send('error', { message: 'Draft not found' });
        controller.close();
        return;
      }

      send('state', initial);
      let lastVersion = initial.draft.version;

      const interval = setInterval(async () => {
        if (closed) { clearInterval(interval); return; }
        try {
          const state = await buildPlayerDraftState(params.id);
          if (!state) { clearInterval(interval); return; }
          if (state.draft.version !== lastVersion) {
            lastVersion = state.draft.version;
            send('state', state);
          } else {
            // Heartbeat to keep connection alive
            if (!closed) controller.enqueue(encoder.encode(': heartbeat\n\n'));
          }
        } catch { clearInterval(interval); }
      }, 2000);
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
