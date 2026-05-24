'use client';

import { useState, useEffect, useCallback } from 'react';
import PendingView from './views/PendingView';
import LobbyView from './views/LobbyView';
import BanView from './views/BanView';
import PickView from './views/PickView';
import CompleteView from './views/CompleteView';
import ChatPanel from './components/ChatPanel';
import { BrutalButton, PixelBadge, RetroWindow, StatusBadge } from '@/components/ui';

const ROLE_LABELS = {
  admin:     { label: 'Admin',     color: 'yellow' },
  captainA:  { label: 'Captain A', color: 'blue' },
  captainB:  { label: 'Captain B', color: 'purple' },
  spectator: { label: 'Spectator', color: 'gray' },
};

export default function DraftClient({ initialState, role, draftKey }) {
  const [state, setState] = useState(initialState);

  const draftId = state.draft.id;

  const refreshState = useCallback(async () => {
    try {
      const res = await fetch(`/api/drafts/${draftId}/state`);
      if (res.ok) setState(await res.json());
    } catch {}
  }, [draftId]);

  useEffect(() => {
    const es = new EventSource(`/api/drafts/${draftId}/stream`);
    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'state') {
        const { type, ...nextState } = data;
        setState(nextState);
      } else if (data.type === 'chats') {
        setState((prev) => ({ ...prev, chats: data.chats }));
      }
    };
    return () => es.close();
  }, [draftId]);

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

  const setStatus = useCallback(async (status) => {
    await fetch('/api/drafts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: draftId, status }),
    });
    await refreshState();
  }, [draftId, refreshState]);

  const { draft, chats } = state;
  const status = draft.status;
  const viewProps = { state, role, draftKey, callApi, draftId };
  const roleCfg = ROLE_LABELS[role] ?? ROLE_LABELS.spectator;

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6">
      <RetroWindow
        title={`DRAFT SESSION.EXE - ${draft.name}`}
        titleBarColor="yellow"
        titleRight={<PixelBadge label={roleCfg.label} color={roleCfg.color} />}
      >
        <div className="flex items-center gap-3 flex-wrap mb-6 border-b-2 border-brand-700 pb-4">
          <StatusBadge status={status} />

          {role === 'admin' && (
            <div className="flex items-center gap-2 flex-wrap ml-auto">
              {status === 'complete' && (
                <BrutalButton onClick={() => handleAdminAction('nextGame')} variant="secondary" size="sm">Next Game</BrutalButton>
              )}
              {(status === 'lobby' || status === 'banning' || status === 'picking' || status === 'complete') && (
                <BrutalButton onClick={() => handleAdminAction('resetDraft')} variant="secondary" size="sm">Reset Draft</BrutalButton>
              )}
              {status === 'complete' && (
                <BrutalButton onClick={() => handleAdminAction('reopenLastPick')} variant="danger" size="sm">Reopen Draft</BrutalButton>
              )}
            </div>
          )}

          <BrutalButton href="/" variant="ghost" size="sm">Home</BrutalButton>
        </div>

        {status === 'pending'  && <PendingView {...viewProps} />}
        {status === 'lobby'    && <LobbyView   {...viewProps} />}
        {status === 'banning'  && <BanView     {...viewProps} />}
        {status === 'picking'  && <PickView    {...viewProps} />}
        {status === 'complete' && <CompleteView {...viewProps} onAdminAction={handleAdminAction} />}

        {status !== 'pending' && (
          <div className="mt-6 max-w-2xl">
            <ChatPanel chats={chats} draftKey={draftKey} draftId={draftId} />
          </div>
        )}
      </RetroWindow>
    </div>
  );
}
