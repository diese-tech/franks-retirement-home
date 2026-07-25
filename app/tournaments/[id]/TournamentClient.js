'use client';

import { useEffect, useRef, useState } from 'react';
import { RetroWindow, PixelBadge } from '@/components/ui';
import BracketTree from './BracketTree';

const STATUS_COLOR = {
  live: 'lime',
  completed: 'purple',
};

export default function TournamentClient({ tournamentId, initialState }) {
  const [state, setState] = useState(initialState);
  const [connected, setConnected] = useState(false);
  // Tracks whether *we* deliberately closed the stream after a `completed`
  // update, so the connection indicator doesn't read as "dropped."
  const closedForGoodRef = useRef(false);

  useEffect(() => {
    closedForGoodRef.current = false;
    const es = new EventSource(`/api/tournaments/${tournamentId}/stream`);

    es.addEventListener('open', () => setConnected(true));
    // A network hiccup — EventSource retries natively on its own, matching
    // this repo's existing SSE client convention (see
    // app/player-draft/[id]/PlayerDraftClient.js, which does the same thing
    // and lets the browser's built-in reconnect handle it rather than
    // rolling manual retry logic).
    es.addEventListener('error', () => {
      if (!closedForGoodRef.current) setConnected(false);
    });

    es.onmessage = (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }
      if (!data || !data.tournament) return; // ignore malformed/unexpected frames

      setState(data);

      // Per ADR-0003 and workstream C's contract, the stream terminates
      // itself right after it pushes a `completed` update — a deliberate,
      // clean server close, not a network error. EventSource auto-reconnects
      // by default on any close, so we must explicitly close our end here
      // too, or a long-finished bracket's page would keep polling forever.
      if (data.tournament.status === 'completed') {
        closedForGoodRef.current = true;
        es.close();
        setConnected(false);
      }
    };

    return () => {
      closedForGoodRef.current = true;
      es.close();
    };
  }, [tournamentId]);

  const { tournament, matches } = state;
  const isCompleted = tournament.status === 'completed';

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <RetroWindow
        title={`TOURNAMENT.EXE - ${tournament.name}`}
        titleBarColor={isCompleted ? 'purple' : 'yellow'}
        titleRight={
          <PixelBadge label={tournament.status} color={STATUS_COLOR[tournament.status] ?? 'gray'} />
        }
      >
        <div className="flex items-center gap-2 mb-4 border-b-2 border-frh-border pb-3">
          {isCompleted ? (
            <span className="font-mono text-[9px] text-frh-text-muted uppercase tracking-widest">
              Final — read only
            </span>
          ) : (
            <>
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-600'}`} />
              <span className="font-mono text-[9px] text-gray-500">
                {connected ? 'LIVE' : 'connecting…'}
              </span>
            </>
          )}
        </div>

        <BracketTree matches={matches} />
      </RetroWindow>
    </div>
  );
}
