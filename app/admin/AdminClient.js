'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PLAYER_ROLES, GOD_ROLES, GOD_CLASSES, STATUS_COLORS, ROLE_COLORS } from '@/lib/constants';

// ─── API helpers ─────────────────────────────────────
async function api(url, opts) { const r = await fetch(url, opts); return r.json(); }
function postJson(url, body) { return api(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
function del(url) { return api(url, { method: 'DELETE' }); }

export default function AdminClient({ initialPlayers, initialGods, initialDrafts }) {
  const [players, setPlayers] = useState(initialPlayers);
  const [gods, setGods] = useState(initialGods);
  const [drafts, setDrafts] = useState(initialDrafts);
  const [tab, setTab] = useState('drafts');

  const refreshPlayers = async () => setPlayers(await api('/api/players'));
  const refreshGods = async () => setGods(await api('/api/gods'));
  const refreshDrafts = async () => setDrafts(await api('/api/drafts'));

  const tabs = [
    { key: 'drafts', label: 'Drafts', count: drafts.length },
    { key: 'players', label: 'Players', count: players.length },
    { key: 'gods', label: 'Gods', count: gods.length },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold uppercase tracking-wider text-gray-200 mb-1">Admin Dashboard</h1>
        <p className="text-sm text-gray-500">Manage players, gods, and draft sessions.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-brand-800 rounded-lg p-1 border border-brand-600/30 w-fit">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-md font-display font-semibold text-sm uppercase tracking-wider transition-all ${tab === t.key ? 'bg-brand-600 text-gray-100 shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>
            {t.label} <span className="ml-1 text-[10px] font-mono opacity-60">{t.count}</span>
          </button>
        ))}
      </div>

      {tab === 'drafts' && <DraftsPanel drafts={drafts} onRefresh={refreshDrafts} />}
      {tab === 'players' && <PlayersPanel players={players} onRefresh={refreshPlayers} />}
      {tab === 'gods' && <GodsPanel gods={gods} onRefresh={refreshGods} />}
    </div>
  );
}

// ─── Drafts Panel ────────────────────────────────────

function DraftsPanel({ drafts, onRefresh }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    await postJson('/api/drafts', { name: name.trim() || `Draft ${drafts.length + 1}` });
    setName('');
    await onRefresh();
    setBusy(false);
  };

  const remove = async (id) => {
    if (!confirm('Delete this draft and all picks?')) return;
    await del(`/api/drafts?id=${id}`);
    onRefresh();
  };

  const setStatus = async (id, status) => {
    await postJson('/api/drafts', { id, status });
    onRefresh();
  };

  return (
    <div className="card">
      <h2 className="font-display font-bold text-base uppercase tracking-wider text-gray-200 mb-4">Drafts</h2>
      <div className="flex gap-2 mb-4">
        <input placeholder="New draft name…" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} className="input-field flex-1" />
        <button onClick={create} disabled={busy} className="btn-primary text-xs shrink-0">{busy ? 'Creating…' : 'Create Draft'}</button>
      </div>
      <div className="space-y-2">
        {drafts.length === 0 ? <p className="text-sm text-gray-600 text-center py-6">No drafts yet</p> : drafts.map((d) => (
          <div key={d.id} className="flex items-center gap-3 px-3 py-3 bg-brand-950/40 rounded-lg border border-brand-600/20 hover:border-brand-600/40 transition-all">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-display font-semibold text-sm text-gray-300 truncate">{d.name}</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-display font-bold uppercase tracking-wider border ${STATUS_COLORS[d.status]}`}>{d.status}</span>
              </div>
              <span className="text-[10px] text-gray-600 font-mono">{new Date(d.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link href={`/draft/${d.id}`} className="text-xs text-frost-400 hover:text-frost-500 font-display font-semibold">Open →</Link>
              {d.status === 'pending' && <button onClick={() => setStatus(d.id, 'active')} className="text-xs text-green-400 hover:text-green-300">Start</button>}
              {d.status === 'active' && <button onClick={() => setStatus(d.id, 'complete')} className="text-xs text-yellow-400 hover:text-yellow-300">Finalize</button>}
              <button onClick={() => remove(d.id)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Players Panel ───────────────────────────────────

function PlayersPanel({ players, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: '', role: 'Mid', pointValue: 3 });
  const [busy, setBusy] = useState(false);

  const reset = () => { setForm({ name: '', role: 'Mid', pointValue: 3 }); setEditId(null); setShowForm(false); };

  const submit = async () => {
    if (!form.name.trim()) return;
    setBusy(true);
    await postJson('/api/players', editId ? { id: editId, ...form } : form);
    reset();
    await onRefresh();
    setBusy(false);
  };

  const edit = (p) => { setForm({ name: p.name, role: p.role, pointValue: p.pointValue }); setEditId(p.id); setShowForm(true); };

  const remove = async (id) => {
    if (!confirm('Delete this player?')) return;
    await del(`/api/players?id=${id}`);
    onRefresh();
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-bold text-base uppercase tracking-wider text-gray-200">Players ({players.length})</h2>
        <button onClick={() => { reset(); setShowForm(!showForm); }} className="btn-primary text-xs">{showForm ? 'Cancel' : '+ Add Player'}</button>
      </div>

      {showForm && (
        <div className="mb-4 p-4 bg-brand-950/60 rounded-lg border border-brand-600/30 space-y-3 animate-fade-in">
          <input placeholder="Player name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" />
          <div className="grid grid-cols-2 gap-3">
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="select-field">
              {PLAYER_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 font-display shrink-0">Points:</label>
              <input type="number" min={0} max={10} value={form.pointValue} onChange={(e) => setForm({ ...form, pointValue: parseInt(e.target.value) || 0 })} className="input-field text-center" />
            </div>
          </div>
          <button onClick={submit} disabled={busy || !form.name.trim()} className="btn-primary w-full text-xs">{busy ? 'Saving…' : editId ? 'Update Player' : 'Add Player'}</button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] font-display uppercase tracking-wider text-gray-500 border-b border-brand-600/30">
              <th className="text-left py-2 px-2">Name</th>
              <th className="text-left py-2 px-2">Role</th>
              <th className="text-center py-2 px-2">Pts</th>
              <th className="text-right py-2 px-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.id} className="border-b border-brand-700/30 hover:bg-brand-700/20 transition-colors">
                <td className="py-2 px-2 font-display font-medium text-gray-300">{p.name}</td>
                <td className="py-2 px-2"><span className={`text-[9px] font-display font-bold uppercase px-1.5 py-0.5 rounded ${ROLE_COLORS[p.role]}`}>{p.role}</span></td>
                <td className="py-2 px-2 text-center font-mono text-gold-400 font-bold">{p.pointValue}</td>
                <td className="py-2 px-2 text-right">
                  <button onClick={() => edit(p)} className="text-xs text-frost-400 hover:text-frost-300 mr-3">Edit</button>
                  <button onClick={() => remove(p.id)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Gods Panel ──────────────────────────────────────

function GodsPanel({ gods, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: '', role: 'Mage', godClass: 'Magical' });
  const [filterRole, setFilterRole] = useState('All');
  const [busy, setBusy] = useState(false);

  const reset = () => { setForm({ name: '', role: 'Mage', godClass: 'Magical' }); setEditId(null); setShowForm(false); };

  const submit = async () => {
    if (!form.name.trim()) return;
    setBusy(true);
    await postJson('/api/gods', editId ? { id: editId, ...form } : form);
    reset();
    await onRefresh();
    setBusy(false);
  };

  const edit = (g) => { setForm({ name: g.name, role: g.role, godClass: g.godClass }); setEditId(g.id); setShowForm(true); };

  const remove = async (id) => {
    if (!confirm('Delete this god?')) return;
    await del(`/api/gods?id=${id}`);
    onRefresh();
  };

  const filtered = filterRole === 'All' ? gods : gods.filter((g) => g.role === filterRole);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-bold text-base uppercase tracking-wider text-gray-200">Gods ({gods.length})</h2>
        <button onClick={() => { reset(); setShowForm(!showForm); }} className="btn-primary text-xs">{showForm ? 'Cancel' : '+ Add God'}</button>
      </div>

      {showForm && (
        <div className="mb-4 p-4 bg-brand-950/60 rounded-lg border border-brand-600/30 space-y-3 animate-fade-in">
          <input placeholder="God name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" />
          <div className="grid grid-cols-2 gap-3">
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="select-field">
              {GOD_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <select value={form.godClass} onChange={(e) => setForm({ ...form, godClass: e.target.value })} className="select-field">
              {GOD_CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <button onClick={submit} disabled={busy || !form.name.trim()} className="btn-primary w-full text-xs">{busy ? 'Saving…' : editId ? 'Update God' : 'Add God'}</button>
        </div>
      )}

      {/* Role filter */}
      <div className="flex flex-wrap gap-1 mb-3">
        {['All', ...GOD_ROLES].map((r) => (
          <button key={r} onClick={() => setFilterRole(r)}
            className={`px-2 py-0.5 rounded text-[10px] font-display font-semibold uppercase tracking-wider transition-colors ${
              filterRole === r ? 'bg-frost-500/20 text-frost-400 border border-frost-500/40' : 'bg-brand-700/50 text-gray-500 border border-transparent hover:text-gray-300'
            }`}>{r}</button>
        ))}
      </div>

      <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-brand-800">
            <tr className="text-[10px] font-display uppercase tracking-wider text-gray-500 border-b border-brand-600/30">
              <th className="text-left py-2 px-2">Name</th>
              <th className="text-left py-2 px-2">Role</th>
              <th className="text-left py-2 px-2">Class</th>
              <th className="text-right py-2 px-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((g) => (
              <tr key={g.id} className="border-b border-brand-700/30 hover:bg-brand-700/20 transition-colors">
                <td className="py-2 px-2 font-display font-medium text-gray-300">{g.name}</td>
                <td className="py-2 px-2 text-gray-500">{g.role}</td>
                <td className="py-2 px-2 text-gray-500">{g.godClass}</td>
                <td className="py-2 px-2 text-right">
                  <button onClick={() => edit(g)} className="text-xs text-frost-400 hover:text-frost-300 mr-3">Edit</button>
                  <button onClick={() => remove(g.id)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
