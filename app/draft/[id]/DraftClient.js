'use client';

import { useState, useEffect, useCallback } from 'react';
import { STATUS_COLORS } from '@/lib/constants';
import PendingView from './views/PendingView';
import LobbyView from './views/LobbyView';
import BanView from './views/BanView';
import PickView from './views/PickView';
import CompleteView from './views/CompleteView';
import ChatPanel from './components/ChatPanel';

const ROLE_LABELS = {
  admin:     { label: 'Admin',       color: 'text-gold-400',   border: 'border-gold-400/30',   bg: 'bg-gold-400/10' },
  captainA:  { label: 'Captain A',   color: 'text-blue-400',   border: 'border-blue-500/30',   bg: 'bg-blue-500/10' },
  captainB:  { label: 'Captain B',   color: 'text-red-400',    border: 'border-red-500/30',    bg: 'bg-red-500/10'  },
  spectator: { label: 'Spectator',   color: 'text-gray-500',   border: 'border-gray-600/30',   bg: 'bg-gray-700/10' },
};

export default function DraftClient({ initialState, role, draftKey }) {
  const [state, setState] = useState(initialState);

  const draftId = state.draft.id;

  // Refresh state immediately from the /state endpoint
  const refreshState = useCallback(async () => {
    try {
      const res = await fetch(`/api/drafts/${draftId}/state`);
      if (res.ok) setState(await res.json());
    } catch {}
  }, [draftId]);

  // SSE subscription for syncing other connected clients
  useEffect(() => {
    const es = new EventSource(`/api/drafts/${draftId}/stream`);
    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'state') {
        const { type, ...nextState } = data;
        setState(nextState);
      }
    };
    // EventSource auto-reconnects on error
    return () => es.close();
  }, [draftId]);

  // Shared helper for captain/admin actions — POSTs with key, then immediately refreshes state
  const callApi = useCallback(async (endpoint, body = {}, method = 'POST') => {
    const res = await fetch(`/api/drafts/${draftId}/${endpoint}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: draftKey, ...body }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    await refreshState();
    return data;
  }, [draftId, draftKey, refreshState]);

  const runAdminAction = useCallback(async (action) => {
    const res = await fetch(`/api/drafts/${draftId}/admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: draftKey, action }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    await refreshState();
    return data;
  }, [draftId, draftKey, refreshState]);

  const handleAdminAction = useCallback(async (action) => {
    try {
      await runAdminAction(action);
    } catch (error) {
      window.alert(error.message);
    }
  }, [runAdminAction]);

  // Admin-only: direct status transition (used in header controls)
  const setStatus = useCallback(async (status) => {
    await fetch('/api/drafts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: draftId, status }),
    });
    await refreshState();
  }, [draftId, refreshState]);

  const { draft, picks, chats } = state;
  const status = draft.status;
  const viewProps = { state, role, draftKey, callApi, draftId };
  const roleCfg = ROLE_LABELS[role] ?? ROLE_LABELS.spectator;

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap mb-6">
        <div className="flex items-center gap-2 mr-auto min-w-0">
          <h1 className="font-display font-bold text-xl uppercase tracking-wider text-gray-200 truncate">{draft.name}</h1>
          <StatusBadge status={status} />
        </div>

        {/* Role indicator */}
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-display font-bold uppercase tracking-wider ${roleCfg.bg} ${roleCfg.border} ${roleCfg.color}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          {roleCfg.label}
        </div>

        {/* Admin-only status controls */}
        {role === 'admin' && (
          <div className="flex items-center gap-2">
            {status === 'complete' && (
              <button onClick={() => handleAdminAction('nextGame')} className="btn-secondary text-xs">Next Game</button>
            )}
            {(status === 'lobby' || status === 'banning' || status === 'picking' || status === 'complete') && (
              <button onClick={() => handleAdminAction('resetDraft')} className="btn-secondary text-xs">Reset Draft</button>
            )}
            {status === 'complete' && (
              <button onClick={() => setStatus('picking')} className="btn-secondary text-xs">Reopen Draft</button>
            )}
            {(status === 'active') && (
              <button onClick={() => setStatus('complete')} className="btn-primary text-xs">Finalize</button>
            )}
          </div>
        )}

        <a href="/" className="text-xs text-gray-600 hover:text-gray-400 font-display">← Home</a>
      </div>

      {/* Phase view */}
      <div>
        {status === 'pending'  && <PendingView {...viewProps} />}
        {status === 'lobby'    && <LobbyView   {...viewProps} />}
        {status === 'banning'  && <BanView     {...viewProps} />}
        {(status === 'picking' || status === 'active') && <PickView {...viewProps} />}
        {status === 'complete' && <CompleteView {...viewProps} />}
      </div>

      {/* Chat — available from lobby onward */}
      {status !== 'pending' && (
        <div className="mt-6 max-w-2xl">
          <ChatPanel chats={chats} draftKey={draftKey} draftId={draftId} />
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const cls = STATUS_COLORS[status] ?? 'bg-gray-500/15 text-gray-400 border-gray-500/30';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-display font-bold uppercase tracking-wider border ${cls}`}>
      {status}
    </span>
  );
}
