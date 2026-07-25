'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { RetroWindow, BrutalButton, PixelBadge } from '@/components/ui';

const STATUS_COLOR = { draft: 'gray', live: 'lime', completed: 'cream' };
const MATCH_STATE_COLOR = { empty: 'gray', ready: 'blue', decided: 'lime' };

// Mirrors lib/bracketEngine.js's matchState() — reimplemented here (instead
// of imported) so this client bundle doesn't pull in that module's Node
// `crypto` import. Keep in sync with the Ready/Decided vocabulary in
// CONTEXT.md: 'ready' when both slots are filled and no winner, 'decided'
// once a winner is recorded.
function matchState(match) {
  if (match.winnerParticipantId) return 'decided';
  if (match.slot1ParticipantId && match.slot2ParticipantId) return 'ready';
  return 'empty';
}

async function api(url, opts) {
  let res;
  try {
    res = await fetch(url, { credentials: 'same-origin', ...opts });
  } catch {
    // Offline or a transient network failure — surface it the same way as
    // a server error rather than throwing, so every caller's busy flag
    // still gets cleared in its `finally` and the banner/inline error
    // actually renders.
    return { ok: false, status: 0, data: { error: 'Could not reach the server. Check your connection and try again.' } };
  }
  let data = null;
  try { data = await res.json(); } catch { /* empty or non-JSON body */ }
  return { ok: res.ok, status: res.status, data: data ?? {} };
}

function patchTournament(id, body) {
  return api(`/api/admin/tournaments/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export default function AdminClient({ tournament }) {
  const router = useRouter();
  const { id, name, status, version, createdAt, participants, matches } = tournament;

  const [banner, setBanner] = useState(null); // { kind: 'error'|'info', text }
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const [matchBusy, setMatchBusy] = useState({}); // matchId -> bool
  const [participantEdits, setParticipantEdits] = useState({}); // participantId -> { name, seed }
  const [participantBusy, setParticipantBusy] = useState({}); // participantId -> bool
  const [participantErr, setParticipantErr] = useState({}); // participantId -> string

  const participantById = Object.fromEntries(participants.map((p) => [p.id, p]));

  const editFor = (p) => participantEdits[p.id] ?? { name: p.name, seed: String(p.seed) };
  const patchEdit = (participantId, patch) => {
    setParticipantEdits((prev) => ({
      ...prev,
      [participantId]: { ...(prev[participantId] ?? editFor(participantById[participantId])), ...patch },
    }));
  };

  const saveName = async (p) => {
    const edit = editFor(p);
    const nextName = edit.name.trim();
    if (!nextName || nextName === p.name) return;
    setParticipantBusy((b) => ({ ...b, [p.id]: true }));
    setParticipantErr((e) => ({ ...e, [p.id]: '' }));
    const { ok, data } = await patchTournament(id, { action: 'editParticipant', participantId: p.id, name: nextName });
    setParticipantBusy((b) => ({ ...b, [p.id]: false }));
    if (!ok) {
      setParticipantErr((e) => ({ ...e, [p.id]: data?.error || 'Could not edit this participant — it may already feed into a decided match.' }));
      return;
    }
    router.refresh();
  };

  const saveSeed = async (p) => {
    const edit = editFor(p);
    const nextSeed = parseInt(edit.seed, 10);
    if (Number.isNaN(nextSeed) || nextSeed === p.seed) return;
    setParticipantBusy((b) => ({ ...b, [p.id]: true }));
    setParticipantErr((e) => ({ ...e, [p.id]: '' }));
    const { ok, data } = await patchTournament(id, { action: 'reseed', participantId: p.id, seed: nextSeed });
    setParticipantBusy((b) => ({ ...b, [p.id]: false }));
    if (!ok) {
      setParticipantErr((e) => ({ ...e, [p.id]: data?.error || 'Could not reseed this participant — a match it feeds into has already been decided.' }));
      return;
    }
    router.refresh();
  };

  const recordWinner = async (match, winnerParticipantId) => {
    if (matchState(match) !== 'ready') return;
    setMatchBusy((b) => ({ ...b, [match.id]: true }));
    setBanner(null);
    const { ok, data } = await patchTournament(id, { action: 'recordWinner', matchId: match.id, winnerParticipantId });
    setMatchBusy((b) => ({ ...b, [match.id]: false }));
    if (!ok) {
      setBanner({ kind: 'error', text: data?.error || 'Could not record that winner.' });
      return;
    }
    router.refresh();
  };

  const publish = async () => {
    if (status !== 'draft') return;
    setLifecycleBusy(true);
    setBanner(null);
    const { ok, data } = await patchTournament(id, { action: 'publish' });
    setLifecycleBusy(false);
    if (!ok) { setBanner({ kind: 'error', text: data?.error || 'Could not publish this tournament.' }); return; }
    router.refresh();
  };

  const reset = async () => {
    if (!confirm('Reset this tournament? All recorded winners will be cleared and it will return to draft.')) return;
    setLifecycleBusy(true);
    setBanner(null);
    const { ok, data } = await patchTournament(id, { action: 'reset' });
    setLifecycleBusy(false);
    if (!ok) { setBanner({ kind: 'error', text: data?.error || 'Could not reset this tournament.' }); return; }
    router.refresh();
  };

  const deleteTournament = async () => {
    if (!confirm(`Delete "${name}" permanently? This removes all participants and matches and cannot be undone.`)) return;
    setLifecycleBusy(true);
    setBanner(null);
    const { ok, data } = await patchTournament(id, { action: 'delete' });
    setLifecycleBusy(false);
    if (!ok) { setBanner({ kind: 'error', text: data?.error || 'Could not delete this tournament.' }); return; }
    router.push('/admin/tournaments');
  };

  const rounds = {};
  for (const m of matches) {
    (rounds[m.round] ??= []).push(m);
  }
  const roundNumbers = Object.keys(rounds).map(Number).sort((a, b) => a - b);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <Link href="/admin/tournaments" className="text-xs text-gray-500 hover:text-frh-yellow font-ui uppercase tracking-wide">&larr; Tournaments</Link>
      </div>

      {banner && (
        <div className={`border-2 p-3 ${banner.kind === 'error' ? 'border-red-700 bg-red-900/20' : 'border-frh-yellow bg-frh-yellow/10'}`}>
          <p className={`font-mono text-xs ${banner.kind === 'error' ? 'text-red-300' : 'text-frh-yellow'}`}>{banner.text}</p>
        </div>
      )}

      <RetroWindow
        title={name}
        titleBarColor="yellow"
        titleRight={<PixelBadge label={status} color={STATUS_COLOR[status] ?? 'gray'} />}
      >
        <p className="font-mono text-[10px] text-gray-500 mb-4">
          {createdAt ? new Date(createdAt).toLocaleString() : ''} · v{version}
        </p>
        <div className="flex flex-wrap gap-2">
          <BrutalButton variant="primary" onClick={publish} disabled={lifecycleBusy || status !== 'draft'}>
            {status === 'draft' ? 'Publish' : 'Published'}
          </BrutalButton>
          <BrutalButton variant="secondary" onClick={reset} disabled={lifecycleBusy}>Reset</BrutalButton>
          <BrutalButton variant="danger" onClick={deleteTournament} disabled={lifecycleBusy}>Delete</BrutalButton>
        </div>
      </RetroWindow>

      <RetroWindow title="PARTICIPANTS" titleBarColor="blue">
        <p className="font-mono text-[10px] text-gray-500 mb-3">
          Editing a name or seed is rejected once a match that participant feeds into has a recorded winner (docs/adr/0008).
        </p>
        <div className="space-y-3">
          {participants.map((p) => {
            const edit = editFor(p);
            const busy = !!participantBusy[p.id];
            const err = participantErr[p.id];
            return (
              <div key={p.id} className="border-2 border-frh-border p-3">
                <div className="flex flex-wrap items-end gap-2">
                  <div className="flex-1 min-w-[10rem]">
                    <label className="block text-[10px] font-ui uppercase text-gray-600 mb-1">Name</label>
                    <input
                      className="input-field w-full"
                      value={edit.name}
                      onChange={(e) => patchEdit(p.id, { name: e.target.value })}
                      disabled={busy}
                    />
                  </div>
                  <div className="w-20">
                    <label className="block text-[10px] font-ui uppercase text-gray-600 mb-1">Seed</label>
                    <input
                      type="number"
                      className="input-field w-full"
                      value={edit.seed}
                      onChange={(e) => patchEdit(p.id, { seed: e.target.value })}
                      disabled={busy}
                    />
                  </div>
                  <BrutalButton size="sm" variant="secondary" disabled={busy || edit.name.trim() === p.name} onClick={() => saveName(p)}>
                    Save Name
                  </BrutalButton>
                  <BrutalButton size="sm" variant="secondary" disabled={busy || parseInt(edit.seed, 10) === p.seed} onClick={() => saveSeed(p)}>
                    Reseed
                  </BrutalButton>
                </div>
                {err && <p className="font-mono text-[10px] text-red-400 mt-2">{err}</p>}
              </div>
            );
          })}
          {participants.length === 0 && <p className="font-mono text-xs text-gray-500">No participants.</p>}
        </div>
      </RetroWindow>

      <RetroWindow title="BRACKET" titleBarColor="purple">
        <div className="space-y-6">
          {roundNumbers.map((round) => (
            <div key={round}>
              <h3 className="font-ui text-xs uppercase tracking-widest text-frh-yellow mb-2">Round {round}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {rounds[round].map((m) => {
                  const state = matchState(m);
                  const slots = [m.slot1ParticipantId, m.slot2ParticipantId];
                  const busy = !!matchBusy[m.id];
                  return (
                    <div key={m.id} className="border-2 border-frh-border p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-[10px] text-gray-500">Match {m.position + 1}</span>
                        <PixelBadge label={state} color={MATCH_STATE_COLOR[state]} />
                      </div>
                      <div className="space-y-1">
                        {slots.map((slotId, i) => {
                          const participant = slotId ? participantById[slotId] : null;
                          const isWinner = slotId && m.winnerParticipantId === slotId;
                          const isLoser = m.winnerParticipantId && slotId && !isWinner;
                          return (
                            <div key={i} className="flex items-center justify-between gap-2">
                              <span
                                className={[
                                  'font-mono text-xs truncate',
                                  isWinner ? 'text-frh-lime font-bold' : 'text-frh-text',
                                  isLoser ? 'line-through opacity-50' : '',
                                  !participant ? 'text-gray-600 italic' : '',
                                ].join(' ')}
                              >
                                {participant?.name ?? 'TBD'}
                              </span>
                              {state === 'ready' && participant && (
                                <BrutalButton
                                  size="sm"
                                  variant="primary"
                                  disabled={busy}
                                  onClick={() => recordWinner(m, participant.id)}
                                >
                                  Winner
                                </BrutalButton>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {roundNumbers.length === 0 && <p className="font-mono text-xs text-gray-500">No bracket matches.</p>}
        </div>
      </RetroWindow>
    </div>
  );
}
