'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { PLAYER_ROLES, GOD_ROLES, GOD_CLASSES, STATUS_COLORS, ROLE_COLORS } from '@/lib/constants';

async function api(url, opts) { const r = await fetch(url, opts); return r.json(); }
function postJson(url, body) { return api(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
function del(url) { return api(url, { method: 'DELETE' }); }

function PasswordGate({ onAuthed }) {
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await fetch('/api/admin-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    });
    if (res.ok) {
      sessionStorage.setItem('frh_admin', '1');
      onAuthed();
    } else {
      setError('Incorrect password');
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="card w-full max-w-sm">
        <h1 className="font-display font-bold text-lg uppercase tracking-wider text-gray-200 mb-1">Admin Access</h1>
        <p className="text-sm text-gray-500 mb-6">Enter the admin password to continue.</p>
        <form onSubmit={submit} className="space-y-4">
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Password"
            className="input-field w-full"
            autoFocus
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button type="submit" disabled={busy || !pw} className="btn-primary w-full">
            {busy ? 'Checking…' : 'Enter'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AdminClient({ initialPlayers, initialGods, initialDrafts }) {
  const [authed, setAuthed] = useState(false);
  const [players, setPlayers] = useState(initialPlayers);
  const [gods, setGods] = useState(initialGods);
  const [drafts, setDrafts] = useState(initialDrafts);
  const [tab, setTab] = useState('drafts');

  useEffect(() => {
    if (sessionStorage.getItem('frh_admin') === '1') setAuthed(true);
  }, []);

  if (!authed) return <PasswordGate onAuthed={() => setAuthed(true)} />;

  const refreshPlayers = async () => setPlayers(await api('/api/players'));
  const refreshGods = async () => setGods(await api('/api/gods'));
  const refreshDrafts = async () => setDrafts(await api('/api/drafts'));

  const tabs = [
    { key: 'drafts',  label: 'Drafts',  count: drafts.length },
    { key: 'players', label: 'Players', count: players.length },
    { key: 'import',  label: 'Import',  count: null },
    { key: 'gods',    label: 'Gods',    count: gods.length },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold uppercase tracking-wider text-gray-200 mb-1">Admin Dashboard</h1>
        <p className="text-sm text-gray-500">Manage players, gods, and draft sessions.</p>
      </div>

      <div className="flex gap-1 mb-6 bg-brand-800 rounded-lg p-1 border border-brand-600/30 w-fit">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-md font-display font-semibold text-sm uppercase tracking-wider transition-all ${tab === t.key ? 'bg-brand-600 text-gray-100 shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>
            {t.label} {t.count !== null && <span className="ml-1 text-[10px] font-mono opacity-60">{t.count}</span>}
          </button>
        ))}
      </div>

      {tab === 'drafts'  && <DraftsPanel  drafts={drafts}   onRefresh={refreshDrafts} />}
      {tab === 'players' && <PlayersPanel players={players} onRefresh={refreshPlayers} />}
      {tab === 'import'  && <ImportPanel  onRefresh={refreshPlayers} />}
      {tab === 'gods'    && <GodsPanel    gods={gods}       onRefresh={refreshGods} />}
    </div>
  );
}

// ─── Share Modal ─────────────────────────────────────

function ShareModal({ draft, onClose }) {
  const [copied, setCopied] = useState(null);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const links = [
    { label: 'Admin Link',    key: 'adminKey',    description: 'Full override access' },
    { label: 'Captain A',     key: 'captainAKey', description: 'Team Alpha captain' },
    { label: 'Captain B',     key: 'captainBKey', description: 'Team Bravo captain' },
    { label: 'Spectator',     key: null,          description: 'Read-only, no key needed' },
  ];

  const getUrl = (keyField) => {
    if (!keyField) return `${origin}/draft/${draft.id}`;
    const val = draft[keyField];
    if (!val) return null;
    return `${origin}/draft/${draft.id}?key=${val}`;
  };

  const copy = async (keyField) => {
    const url = getUrl(keyField);
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(keyField ?? 'spectator');
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-brand-800 border border-brand-600/40 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-display font-bold text-base uppercase tracking-wider text-gray-200">Share Links</h2>
            <p className="text-xs text-gray-500 mt-0.5">{draft.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xl leading-none">✕</button>
        </div>

        <div className="space-y-3">
          {links.map(({ label, key, description }) => {
            const url = getUrl(key);
            const wasCopied = copied === (key ?? 'spectator');
            return (
              <div key={label} className="flex items-center gap-3 p-3 bg-brand-900/60 rounded-lg border border-brand-600/20">
                <div className="flex-1 min-w-0">
                  <div className="font-display font-semibold text-xs text-gray-300">{label}</div>
                  <div className="text-[10px] text-gray-600">{description}</div>
                  {url
                    ? <div className="text-[10px] font-mono text-gray-500 truncate mt-0.5">{url}</div>
                    : <div className="text-[10px] text-gray-700 mt-0.5">No key assigned (legacy draft)</div>
                  }
                </div>
                <button
                  onClick={() => copy(key)}
                  disabled={!url}
                  className={`shrink-0 px-3 py-1.5 rounded text-[10px] font-display font-bold uppercase tracking-wider transition-all ${
                    wasCopied
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : url
                        ? 'bg-brand-600/50 text-gray-300 border border-brand-500/40 hover:bg-frost-500/15 hover:text-frost-400 hover:border-frost-500/40'
                        : 'opacity-30 cursor-not-allowed bg-brand-700 text-gray-600 border border-brand-600/20'
                  }`}
                >
                  {wasCopied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            );
          })}
        </div>

        <p className="text-[10px] text-gray-600 mt-4 text-center">
          Share Admin, Captain A, and Captain B links privately. The spectator link is safe to post publicly.
        </p>
      </div>
    </div>
  );
}

// ─── Drafts Panel ────────────────────────────────────

function DraftsPanel({ drafts, onRefresh }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [shareTarget, setShareTarget] = useState(null);

  const create = async () => {
    setBusy(true);
    const draft = await postJson('/api/drafts', { name: name.trim() || `Draft ${drafts.length + 1}` });
    setName('');
    await onRefresh();
    setShareTarget(draft);
    setBusy(false);
  };

  const remove = async (id) => {
    if (!confirm('Delete this draft and all picks?')) return;
    await del(`/api/drafts?id=${id}`);
    onRefresh();
  };

  const setStatus = async (id, status) => {
    const result = await postJson('/api/drafts', { id, status });
    if (result.error) { alert(result.error); return; }
    onRefresh();
  };

  // Find the latest version of a draft (post-refresh) for share modal
  const findDraft = (id) => drafts.find((d) => d.id === id) ?? shareTarget;

  return (
    <>
      {shareTarget && (
        <ShareModal
          draft={findDraft(shareTarget.id)}
          onClose={() => setShareTarget(null)}
        />
      )}
      <div className="card">
        <h2 className="font-display font-bold text-base uppercase tracking-wider text-gray-200 mb-4">Drafts</h2>
        <div className="flex gap-2 mb-4">
          <input
            placeholder="New draft name…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
            className="input-field flex-1"
          />
          <button onClick={create} disabled={busy} className="btn-primary text-xs shrink-0">
            {busy ? 'Creating…' : 'Create Draft'}
          </button>
        </div>
        <div className="space-y-2">
          {drafts.length === 0
            ? <p className="text-sm text-gray-600 text-center py-6">No drafts yet</p>
            : drafts.map((d) => (
              <div key={d.id} className="flex items-center gap-3 px-3 py-3 bg-brand-950/40 rounded-lg border border-brand-600/20 hover:border-brand-600/40 transition-all">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-display font-semibold text-sm text-gray-300 truncate">{d.name}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-display font-bold uppercase tracking-wider border ${STATUS_COLORS[d.status] ?? STATUS_COLORS.pending}`}>{d.status}</span>
                  </div>
                  <span className="text-[10px] text-gray-600 font-mono">{new Date(d.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <Link href={`/draft/${d.id}${d.adminKey ? `?key=${d.adminKey}` : ''}`}
                    className="text-xs text-frost-400 hover:text-frost-300 font-display font-semibold">Open →</Link>
                  <button onClick={() => setShareTarget(d)} className="text-xs text-gold-400 hover:text-gold-300 font-display font-semibold">Share</button>
                  {d.status === 'pending' && (
                    <button onClick={() => setStatus(d.id, 'lobby')} className="text-xs text-blue-400 hover:text-blue-300">Open Lobby</button>
                  )}
                  {d.status === 'active' && (
                    <button onClick={() => setStatus(d.id, 'complete')} className="text-xs text-yellow-400 hover:text-yellow-300">Finalize</button>
                  )}
                  {d.status === 'complete' && (
                    <button onClick={() => setStatus(d.id, 'picking')} className="text-xs text-gray-400 hover:text-gray-300">Reopen</button>
                  )}
                  <button onClick={() => remove(d.id)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
                </div>
              </div>
            ))}
        </div>
      </div>
    </>
  );
}

// ─── Players Panel ───────────────────────────────────

function PlayersPanel({ players, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: '', role: 'Mid', discordUsername: '', division: '' });
  const [filterDiv, setFilterDiv] = useState('All');
  const [busy, setBusy] = useState(false);

  const reset = () => { setForm({ name: '', role: 'Mid', discordUsername: '', division: '' }); setEditId(null); setShowForm(false); };

  const submit = async () => {
    if (!form.name.trim()) return;
    setBusy(true);
    await postJson('/api/players', editId ? { id: editId, ...form } : form);
    reset();
    await onRefresh();
    setBusy(false);
  };

  const edit = (p) => {
    setForm({ name: p.name, role: p.role, discordUsername: p.discordUsername || '', division: p.division || '' });
    setEditId(p.id);
    setShowForm(true);
  };

  const remove = async (id) => {
    if (!confirm('Delete this player?')) return;
    const result = await del(`/api/players?id=${id}`);
    if (result.error) { alert(result.error); return; }
    onRefresh();
  };

  const divisions = ['All', ...Array.from(new Set(players.map((p) => p.division).filter(Boolean))).sort()];
  const filtered = filterDiv === 'All' ? players : players.filter((p) => p.division === filterDiv);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-bold text-base uppercase tracking-wider text-gray-200">Players ({players.length})</h2>
        <button onClick={() => { reset(); setShowForm(!showForm); }} className="btn-primary text-xs">{showForm ? 'Cancel' : '+ Add Player'}</button>
      </div>

      {showForm && (
        <div className="mb-4 p-4 bg-brand-950/60 rounded-lg border border-brand-600/30 space-y-3 animate-fade-in">
          <input placeholder="IGN / Player name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" />
          <div className="grid grid-cols-2 gap-3">
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="select-field">
              {PLAYER_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <input placeholder="Division (e.g. Canes)" value={form.division} onChange={(e) => setForm({ ...form, division: e.target.value })} className="input-field" />
          </div>
          <input placeholder="Discord username" value={form.discordUsername} onChange={(e) => setForm({ ...form, discordUsername: e.target.value })} className="input-field" />
          <button onClick={submit} disabled={busy || !form.name.trim()} className="btn-primary w-full text-xs">{busy ? 'Saving…' : editId ? 'Update Player' : 'Add Player'}</button>
        </div>
      )}

      {divisions.length > 1 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {divisions.map((d) => (
            <button key={d} onClick={() => setFilterDiv(d)}
              className={`px-2 py-0.5 rounded text-[10px] font-display font-semibold uppercase tracking-wider transition-colors ${
                filterDiv === d ? 'bg-frost-500/20 text-frost-400 border border-frost-500/40' : 'bg-brand-700/50 text-gray-500 border border-transparent hover:text-gray-300'
              }`}>{d}</button>
          ))}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] font-display uppercase tracking-wider text-gray-500 border-b border-brand-600/30">
              <th className="text-left py-2 px-2">Name</th>
              <th className="text-left py-2 px-2">Discord</th>
              <th className="text-left py-2 px-2">Role</th>
              <th className="text-left py-2 px-2">Division</th>
              <th className="text-right py-2 px-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-b border-brand-700/30 hover:bg-brand-700/20 transition-colors">
                <td className="py-2 px-2 font-display font-medium text-gray-300">{p.name}</td>
                <td className="py-2 px-2 text-xs text-gray-500 font-mono">{p.discordUsername || <span className="text-gray-700">—</span>}</td>
                <td className="py-2 px-2"><span className={`text-[9px] font-display font-bold uppercase px-1.5 py-0.5 rounded ${ROLE_COLORS[p.role]}`}>{p.role}</span></td>
                <td className="py-2 px-2 text-xs text-gray-500">{p.division || <span className="text-gray-700">—</span>}</td>
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

// ─── Import Panel ────────────────────────────────────

const ROLE_ALIASES = {
  solo: 'Solo', jungle: 'Jungle', mid: 'Mid', support: 'Support',
  carry: 'Carry', adc: 'Carry', fill: 'Fill',
};

function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  // Skip header row
  return lines.slice(1).map((line) => {
    // Simple CSV split respecting quoted fields
    const cols = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { cols.push(cur); cur = ''; }
      else { cur += ch; }
    }
    cols.push(cur);

    const rawName = (cols[6] || '').replace(/\(.*?\)/g, '').trim();
    const rawDiscord = (cols[8] || '').trim();
    const rawRole = (cols[14] || '').trim().toLowerCase();
    const role = ROLE_ALIASES[rawRole] || null;

    return { name: rawName, discordUsername: rawDiscord, role, _rawRole: cols[14]?.trim() };
  }).filter((r) => r.name);
}

function ImportPanel({ onRefresh }) {
  const [division, setDivision] = useState('');
  const [csvText, setCsvText] = useState('');
  const [rows, setRows] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const parse = () => {
    const parsed = parseCSV(csvText);
    setRows(parsed);
    setResult(null);
  };

  const updateRow = (i, field, value) => {
    setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  };

  const ready = rows?.filter((r) => r.role) ?? [];
  const invalid = rows?.filter((r) => !r.role) ?? [];

  const importAll = async () => {
    if (!ready.length) return;
    setBusy(true);
    const payload = ready.map((r) => ({
      name: r.name,
      role: r.role,
      discordUsername: r.discordUsername || null,
      division: division.trim() || null,
    }));
    const res = await postJson('/api/players/import', { players: payload });
    setResult(res);
    await onRefresh();
    setBusy(false);
  };

  const reset = () => { setCsvText(''); setRows(null); setResult(null); setDivision(''); };

  return (
    <div className="space-y-4">
      <div className="card">
        <h2 className="font-display font-bold text-base uppercase tracking-wider text-gray-200 mb-1">CSV Import</h2>
        <p className="text-xs text-gray-500 mb-4">
          Paste a sign-up sheet CSV below. Each import batch can be tagged with a division. Run multiple imports for multiple divisions.
        </p>

        <div className="space-y-3">
          <input
            placeholder="Division label (e.g. Canes, Walker, Rollator, Scooter)"
            value={division}
            onChange={(e) => setDivision(e.target.value)}
            className="input-field"
          />
          <textarea
            placeholder="Paste CSV text here…"
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            rows={6}
            className="input-field font-mono text-xs w-full resize-y"
          />
          <div className="flex gap-2">
            <button onClick={parse} disabled={!csvText.trim()} className="btn-primary text-xs">Parse & Preview</button>
            {rows && <button onClick={reset} className="btn-secondary text-xs">Reset</button>}
          </div>
        </div>
      </div>

      {result && (
        <div className="card">
          <div className="text-sm font-display font-bold text-green-400 mb-1">Import Complete</div>
          <div className="flex gap-6 text-xs text-gray-400">
            <span><span className="text-green-400 font-bold">{result.imported}</span> new players added</span>
            <span><span className="text-blue-400 font-bold">{result.updated}</span> existing players updated</span>
            {result.errors?.length > 0 && <span><span className="text-red-400 font-bold">{result.errors.length}</span> errors</span>}
          </div>
        </div>
      )}

      {rows && !result && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="font-display font-bold text-sm text-gray-200">{rows.length} rows parsed</span>
              {invalid.length > 0 && (
                <span className="ml-3 text-xs text-yellow-400">{invalid.length} need a role assigned</span>
              )}
            </div>
            <button onClick={importAll} disabled={busy || !ready.length} className="btn-primary text-xs">
              {busy ? 'Importing…' : `Import ${ready.length} players`}
            </button>
          </div>

          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-brand-800">
                <tr className="text-[10px] font-display uppercase tracking-wider text-gray-500 border-b border-brand-600/30">
                  <th className="text-left py-2 px-2">IGN</th>
                  <th className="text-left py-2 px-2">Discord</th>
                  <th className="text-left py-2 px-2">Role</th>
                  <th className="text-left py-2 px-2">Division</th>
                  <th className="text-left py-2 px-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={`border-b border-brand-700/30 ${!r.role ? 'bg-yellow-500/5' : ''}`}>
                    <td className="py-1.5 px-2 font-display font-medium text-gray-300">{r.name}</td>
                    <td className="py-1.5 px-2 font-mono text-gray-500">{r.discordUsername || '—'}</td>
                    <td className="py-1.5 px-2">
                      {r.role
                        ? <span className={`text-[9px] font-display font-bold uppercase px-1.5 py-0.5 rounded ${ROLE_COLORS[r.role]}`}>{r.role}</span>
                        : (
                          <select value="" onChange={(e) => updateRow(i, 'role', e.target.value)} className="select-field text-[10px] py-0.5 px-1">
                            <option value="">Pick role…</option>
                            {PLAYER_ROLES.map((ro) => <option key={ro} value={ro}>{ro}</option>)}
                          </select>
                        )
                      }
                    </td>
                    <td className="py-1.5 px-2 text-gray-500">{division || <span className="text-gray-700">—</span>}</td>
                    <td className="py-1.5 px-2">
                      {r.role
                        ? <span className="text-[9px] text-green-400 font-display font-bold uppercase">Ready</span>
                        : <span className="text-[9px] text-yellow-400 font-display font-bold uppercase">Needs role</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
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
    const result = await del(`/api/gods?id=${id}`);
    if (result.error) { alert(result.error); return; }
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
