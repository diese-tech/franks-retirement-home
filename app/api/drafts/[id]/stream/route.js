import prisma from '@/lib/db';
import { buildChatPayload, buildDraftState } from '@/lib/draftState';

export const dynamic = 'force-dynamic';

// GET /api/drafts/[id]/stream
//
// Server-Sent Events. Polls the draft row every 1.5 s and emits one of:
//   - { type: 'state', ... } — full sanitized state, when Draft.version changed
//   - { type: 'chats', chats } — lightweight chat-only frame, when Draft.chatsVersion changed
//   - { type: 'not_found' } — closes the stream
//
// Issue #8: chat used to bump Draft.version, which forced a full state push
// (including the entire god + player tables) for every message. Now chat
// rides its own version counter and ships only the chat list.
export async function GET(request, { params }) {
  const { id } = await params;
  const encoder = new TextEncoder();
  let closed = false;
  let lastVersion = -1;
  let lastChatsVersion = -1;

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
            select: { version: true, chatsVersion: true },
          });
          if (!row) {
            send({ type: 'not_found' });
            try { controller.close(); } catch {}
            return;
          }
          if (row.version !== lastVersion) {
            lastVersion = row.version;
            // The full state already includes the latest chat history, so
            // align lastChatsVersion to avoid a redundant chats frame on
            // the very next poll.
            lastChatsVersion = row.chatsVersion;
            const state = await buildDraftState(id);
            if (state) send({ type: 'state', ...state });
          } else if (row.chatsVersion !== lastChatsVersion) {
            lastChatsVersion = row.chatsVersion;
            const payload = await buildChatPayload(id);
            send({ type: 'chats', ...payload });
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
