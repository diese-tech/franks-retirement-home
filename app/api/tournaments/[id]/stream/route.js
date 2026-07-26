import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { buildTournamentState } from '@/lib/tournamentState';
import { reportServerError } from '@/lib/apiError';

export const dynamic = 'force-dynamic';

// GET /api/tournaments/[id]/stream
//
// Server-Sent Events. Direct port of app/api/drafts/[id]/stream/route.js's
// poll pattern: poll Tournament.version every 1.5s and push a full
// sanitized state frame ({ type: 'state', ... }) whenever it changes. No
// new transport invented here — same reuse call as the rest of this
// codebase's real-time surfaces.
//
// Two deliberate differences from the Draft stream, both from
// docs/tournament-bracket-implementation-plan.md (workstream C):
//
//   - A missing or `draft` tournament (docs/adr/0003, docs/adr/0006 — the
//     id isn't secret) 404s the initial HTTP response outright, rather than
//     opening the stream and emitting a `not_found` SSE frame the way the
//     Draft stream does.
//   - Once a pushed state has `tournament.status === 'completed'`, that
//     frame is sent and the stream is genuinely terminated server-side
//     (timer cleared, controller.close()) rather than just left to idle —
//     per ADR-0003 a completed tournament never changes again, and the
//     viewer client does not reconnect after a clean server-initiated
//     close, so this is what actually stops the polling.
export async function GET(request, { params }) {
  const { id } = await params;

  let initialState;
  try {
    initialState = await buildTournamentState(id);
  } catch (err) {
    reportServerError(err, { route: 'tournaments/[id]/stream GET' });
    return NextResponse.json({ error: 'Failed to load tournament state' }, { status: 500 });
  }
  if (!initialState) {
    return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
  }

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      let timer = null;
      let lastVersion = initialState.tournament.version;

      const send = (obj) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        } catch {
          closed = true;
        }
      };

      const stop = () => {
        closed = true;
        if (timer) clearTimeout(timer);
        try { controller.close(); } catch {}
      };

      const poll = async () => {
        if (closed) return;
        try {
          const row = await prisma.tournament.findUnique({
            where: { id },
            select: { version: true, status: true },
          });
          if (!row || row.status === 'draft') {
            send({ type: 'not_found' });
            stop();
            return;
          }
          if (row.version !== lastVersion) {
            const state = await buildTournamentState(id);
            if (!state) {
              send({ type: 'not_found' });
              stop();
              return;
            }
            lastVersion = row.version;
            send({ type: 'state', ...state });
            if (state.tournament.status === 'completed') {
              stop();
              return;
            }
          }
        } catch (err) {
          reportServerError(err, { route: 'tournaments/[id]/stream poll' });
          // Swallow poll errors — keep the stream alive
        }
        if (!closed) timer = setTimeout(poll, 1500);
      };

      request.signal.addEventListener('abort', () => {
        closed = true;
        if (timer) clearTimeout(timer);
        try { controller.close(); } catch {}
      });

      // Push the state already fetched for the 404 check as the first
      // frame, then start polling for subsequent changes.
      send({ type: 'state', ...initialState });
      if (initialState.tournament.status === 'completed') {
        stop();
      } else {
        timer = setTimeout(poll, 1500);
      }
    },
    cancel() {
      closed = true;
    },
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
