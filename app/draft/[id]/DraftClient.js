'use client';

import { useState, useMemo, useCallback } from 'react';
import { evaluateDraft } from '@/lib/rules';
import { ROLE_COLORS, PLAYER_ROLES } from '@/lib/constants';

// ─── API helpers ─────────────────────────────────────
async function api(url, opts) {
  const res = await fetch(url, opts);
  return res.json();
}
function postJson(url, body) {
  return api(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}
function del(url) {
  return api(url, { method: 'DELETE' });
}

export default function DraftClient({ initialDraft, initialPicks, initialPlayers, initialGods }) {
  const [draft, setDraft] = useState(initialDraft);
  const [picks, setPicks] = useState(initialPicks);
  const [players] = useState(initialPlayers);
  const [gods] = useState(initialGods);
  const [roleFilter, setRoleFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [resetConfirm, setResetConfirm] = useState(false);

  const active = draft.status === 'active';
  const evaluation = useMemo(() => evaluateDraft(picks), [picks]);
  const draftedIds = useMemo(() => new Set(picks.map((p) => p.playerId)), [picks]);
  const penalizedTeam = evaluation.violations.find((v) => v.severity === 'critical')?.penalizedTeam ?? null;

  // Filtered available players
  const available = useMemo(() => {
    return players.filter((p) => {
      if (draftedIds.has(p.id)) return false;
      if (roleFilter !== 'All' && p.role !== roleFilter) return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [players, draftedIds, roleFilter, search]);

  // ── Actions ─────────────────────────────────────
  const refreshPicks = useCallback(async () => {
    const data = await api(`/api/draft-picks?draftId=${draft.id}`);
    setPicks(data);
  }, [draft.id]);

  const draftPlayer = async (playerId, team) => {
    await postJson('/api/draft-picks', { draftId: draft.id, playerId, team, pickOrder: picks.length + 1 });
    refreshPicks();
  };

  const changeGod = async (pickId, godId) => {
    await postJson('/api/draft-picks', { id: pickId, godId: godId || null });
    refreshPicks();
  };

  const removePick = async (pickId) => {
    await del(`/api/draft-picks?id=${pickId}`);
    refreshPicks();
  };

  const setStatus = async (status) => {
    const updated = await postJson('/api/drafts', { id: draft.id, status });
    setDraft(updated);
  };

  const resetPicks = async () => {
    await del(`/api/draft-picks?draftId=${draft.id}&clear=true`);
    setPicks([]);
    setResetConfirm(false);
  };

  // ── Render ──────────────────────────────────────
  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6">
      {/* ── Controls ──────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap mb-6">
        <div className="flex items-center gap-2 mr-auto">
          <h1 className="font-display font-bold text-xl uppercase tracking-wider text-gray-200">{draft.name}</h1>
          <StatusBadge status={draft.status} />
        </div>
        {draft.status === 'pending' && <button onClick={() => setStatus('active')} className="btn-primary text-xs">Start Draft</button>}
        {active && (
          <>
            <button onClick={() => setStatus('complete')} className="btn-primary text-xs">Finalize</button>
            {resetConfirm ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/30 rounded-md animate-fade-in">
                <span className="text-xs text-red-300">Clear all picks?</span>
                <button onClick={resetPicks} className="text-xs font-display font-bold text-red-400 hover:text-red-300 uppercase">Yes</button>
                <button onClick={() => setResetConfirm(false)} className="text-xs font-display font-bold text-gray-500 hover:text-gray-300 uppercase">No</button>
              </div>
            ) : (
              <button onClick={() => setResetConfirm(true)} className="btn-danger text-xs">Reset Picks</button>
            )}
          </>
        )}
        {draft.status === 'complete' && <button onClick={() => setStatus('active')} className="btn-secondary text-xs">Reopen Draft</button>}
      </div>

      {/* ── Main Grid ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_200px_1fr] gap-4">
        {/* Player Pool */}
        <div className="card max-h-[75vh] flex flex-col overflow-hidden">
          <h3 className="font-display font-bold text-xs uppercase tracking-wider text-gray-400 mb-2">Player Pool</h3>
          <input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="input-field mb-2 text-xs" />
          <div className="flex flex-wrap gap-1 mb-2">
            {['All', ...PLAYER_ROLES].map((r) => (
              <button key={r} onClick={() => setRoleFilter(r)}
                className={`px-2 py-0.5 rounded text-[10px] font-display font-semibold uppercase tracking-wider transition-colors ${
                  roleFilter === r ? 'bg-frost-500/20 text-frost-400 border border-frost-500/40' : 'bg-brand-700/50 text-gray-500 border border-transparent hover:text-gray-300'
                }`}>{r}</button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto space-y-1 pr-1">
            {available.length === 0 ? (
              <p className="text-xs text-gray-600 text-center py-6">No available players</p>
            ) : available.map((player) => (
              <div key={player.id} className="group flex items-center gap-2 px-2 py-1.5 rounded bg-brand-950/40 border border-brand-600/20 hover:border-brand-600/40 transition-all">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-display font-medium text-sm text-gray-300 truncate">{player.name}</span>
                    <span className={`text-[9px] font-display font-bold uppercase px-1.5 py-0.5 rounded ${ROLE_COLORS[player.role]}`}>{player.role}</span>
                  </div>
                </div>
                <span className="font-mono text-xs text-gold-400 font-bold w-5 text-center">{player.pointValue}</span>
                {active && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => draftPlayer(player.id, 'A')} className="px-1.5 py-0.5 text-[10px] font-display font-bold uppercase rounded bg-blue-500/15 text-blue-400 hover:bg-blue-500/25">A</button>
                    <button onClick={() => draftPlayer(player.id, 'B')} className="px-1.5 py-0.5 text-[10px] font-display font-bold uppercase rounded bg-red-500/15 text-red-400 hover:bg-red-500/25">B</button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-brand-600/30 text-[10px] text-gray-600 font-mono text-center">
            {available.length} available · {draftedIds.size} drafted
          </div>
        </div>

        {/* Team A */}
        <TeamColumn team="A" stats={evaluation.teamA} gods={gods} penalized={penalizedTeam === 'A'} active={active} onGodChange={changeGod} onRemove={removePick} />

        {/* Scoreboard */}
        <div className="flex flex-col gap-4">
          <div className="card text-center">
            <div className="text-[10px] font-display uppercase tracking-widest text-gray-500 mb-1">Point Difference</div>
            <div className={`font-mono text-4xl font-bold ${evaluation.diff >= 3 ? 'text-red-400' : evaluation.diff >= 2 ? 'text-yellow-400' : 'text-green-400'}`}>
              {evaluation.diff}
            </div>
            <div className="flex items-center justify-center gap-3 mt-3 text-xs font-mono">
              <span className="text-blue-400">{evaluation.teamA.points} A</span>
              <span className="text-gray-600">vs</span>
              <span className="text-red-400">{evaluation.teamB.points} B</span>
            </div>
          </div>
          <BalanceIndicator evaluation={evaluation} />
        </div>

        {/* Team B */}
        <TeamColumn team="B" stats={evaluation.teamB} gods={gods} penalized={penalizedTeam === 'B'} active={active} onGodChange={changeGod} onRemove={removePick} />
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────

function StatusBadge({ status }) {
  const colors = { pending: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30', active: 'bg-green-500/15 text-green-400 border-green-500/30', complete: 'bg-gray-500/15 text-gray-400 border-gray-500/30' };
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-display font-bold uppercase tracking-wider border ${colors[status]}`}>{status}</span>;
}

function BalanceIndicator({ evaluation }) {
  const { rating, violations } = evaluation;
  const cfg = {
    balanced:  { dot: 'bg-green-400',  text: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/30',  label: 'BALANCED' },
    caution:   { dot: 'bg-yellow-400', text: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30', label: 'CAUTION' },
    penalized: { dot: 'bg-red-400',    text: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/30 animate-pulse-glow', label: 'PENALTY' },
  }[rating];

  return (
    <div className={`rounded-lg border p-4 ${cfg.bg} transition-all`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
        <span className={`font-display font-bold text-xs uppercase tracking-wider ${cfg.text}`}>{cfg.label}</span>
      </div>
      {violations.length > 0 ? (
        <div className="space-y-1">
          {violations.map((v) => (
            <div key={v.id} className={`text-[11px] px-2 py-1 rounded ${v.severity === 'critical' ? 'bg-red-500/10 text-red-300' : 'bg-yellow-500/10 text-yellow-300'}`}>
              {v.message}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-gray-500">Teams are balanced.</p>
      )}
    </div>
  );
}

function TeamColumn({ team, stats, gods, penalized, active, onGodChange, onRemove }) {
  const isA = team === 'A';
  const accent = isA ? 'text-blue-400' : 'text-red-400';
  const accentBg = isA ? 'bg-blue-500/15' : 'bg-red-500/15';
  const borderColor = isA ? 'border-blue-500/30' : 'border-red-500/30';
  const colBg = isA ? 'bg-[#0d1225]' : 'bg-[#1a0d0d]';

  return (
    <div className={`rounded-xl border ${borderColor} ${colBg} overflow-hidden transition-all ${penalized ? 'animate-pulse-glow ring-2 ring-red-500/40' : ''}`}>
      {/* Header */}
      <div className={`px-5 py-4 border-b ${borderColor} flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${isA ? 'bg-blue-400' : 'bg-red-400'}`} />
          <h2 className={`font-display font-bold text-lg uppercase tracking-wider ${accent}`}>
            Team {isA ? 'Alpha' : 'Bravo'}
          </h2>
        </div>
        <div className="text-right">
          <div className={`font-mono text-2xl font-bold ${accent}`}>{stats.points}</div>
          <div className="text-[10px] uppercase tracking-widest text-gray-500 font-display">Points</div>
        </div>
      </div>

      {penalized && (
        <div className="mx-4 mt-3 px-3 py-2 bg-red-500/15 border border-red-500/30 rounded text-center">
          <span className="text-red-400 font-display font-bold text-xs uppercase tracking-wider">⚠ Penalty Active</span>
        </div>
      )}

      {/* Picks */}
      <div className="p-4 space-y-2 min-h-[200px]">
        {stats.picks.length === 0 ? (
          <div className="text-center py-10 text-gray-600 text-sm">No players drafted</div>
        ) : stats.picks.map((pick, i) => (
          <div key={pick.id} className="group flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-800/60 border border-brand-600/20 hover:border-brand-600/40 transition-all animate-slide-up" style={{ animationDelay: `${i * 40}ms` }}>
            <span className="w-5 h-5 rounded bg-brand-700 flex items-center justify-center text-[10px] font-mono text-gray-500 shrink-0">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-display font-semibold text-sm text-gray-200 truncate">{pick.player?.name}</span>
                <span className="text-[9px] font-mono text-gray-500 uppercase">{pick.player?.role}</span>
              </div>
              {active ? (
                <select value={pick.godId || ''} onChange={(e) => onGodChange(pick.id, e.target.value)}
                  className="mt-1 w-full text-xs bg-brand-950/80 border border-brand-600/40 rounded px-2 py-1 text-gray-300 focus:outline-none focus:border-frost-500/50">
                  <option value="">— Select God —</option>
                  {gods.map((g) => <option key={g.id} value={g.id}>{g.name} ({g.role})</option>)}
                </select>
              ) : pick.god && <span className="text-xs text-gray-500 mt-0.5 block">{pick.god.name}</span>}
            </div>
            <span className={`shrink-0 w-7 h-7 rounded flex items-center justify-center font-mono font-bold text-xs ${accentBg} ${accent}`}>
              {pick.player?.pointValue}
            </span>
            {active && (
              <button onClick={() => onRemove(pick.id)} className="shrink-0 w-6 h-6 rounded flex items-center justify-center text-gray-600 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all" title="Remove">✕</button>
            )}
          </div>
        ))}
      </div>

      <div className={`px-5 py-3 border-t ${borderColor} flex items-center justify-between text-xs text-gray-500`}>
        <span className="font-display uppercase tracking-wider">{stats.count} Players</span>
        <span className="font-mono">{stats.points} pts</span>
      </div>
    </div>
  );
}
