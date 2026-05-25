'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import RetroWindow from '@/components/ui/RetroWindow';
import BrutalButton from '@/components/ui/BrutalButton';
import ExtractionReviewPanel from './ExtractionReviewPanel';

function fuzzyResolvePlayer(ign, members) {
  const norm = ign.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const m of members) {
    const name = m.player.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const discord = (m.player.discordUsername ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const aliasHit = m.player.aliases?.some(a => a.alias.toLowerCase().replace(/[^a-z0-9]/g, '') === norm);
    if (name === norm || discord === norm || aliasHit) return { id: m.player.id, confidence: 'exact' };
  }
  for (const m of members) {
    const name = m.player.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (name.includes(norm) || norm.includes(name)) return { id: m.player.id, confidence: 'fuzzy' };
  }
  return { id: null, confidence: 'none' };
}

function resolveGod(godRaw, gods) {
  if (!godRaw) return null;
  const norm = godRaw.toLowerCase().trim();
  return gods.find(g => g.name.toLowerCase() === norm)?.id
    ?? gods.find(g => g.name.toLowerCase().includes(norm) || norm.includes(g.name.toLowerCase()))?.id
    ?? null;
}

export default function MatchReportClient({ initialMatches, gods, recentExtractions: initial }) {
  const [matches] = useState(initialMatches);
  const [extractions, setExtractions] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [selectedMatchId, setSelectedMatchId] = useState('');
  const [selectedGameId, setSelectedGameId] = useState('');
  const [screenshot, setScreenshot] = useState(null); // { base64, mimeType, previewUrl }
  const [extracting, setExtracting] = useState(false);
  const [extraction, setExtraction] = useState(null); // the API result
  const [reviewRows, setReviewRows] = useState(null);
  const [orderTeamId, setOrderTeamId] = useState(null);
  const [winnerTeamId, setWinnerTeamId] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const dropRef = useRef(null);

  const selectedMatch = matches.find(m => m.id === selectedMatchId) ?? null;
  const selectedGame = selectedMatch?.games.find(g => g.id === selectedGameId) ?? null;

  // Build review rows from extraction once orderTeamId is set
  useEffect(() => {
    if (!extraction || !orderTeamId || !selectedMatch) return;
    const orderMembers = orderTeamId === selectedMatch.homeTeam.id
      ? selectedMatch.homeTeam.members
      : selectedMatch.awayTeam.members;
    const chaosMembers = orderTeamId === selectedMatch.homeTeam.id
      ? selectedMatch.awayTeam.members
      : selectedMatch.homeTeam.members;

    setReviewRows(extraction.rows.map(r => {
      const members = r.teamRaw === 'order' ? orderMembers : chaosMembers;
      const resolved = r.resolvedPlayerId
        ? { id: r.resolvedPlayerId, confidence: 'exact' }
        : fuzzyResolvePlayer(r.ignRaw, members);
      return {
        id: r.id,
        ignRaw: r.ignRaw,
        side: r.teamRaw,
        godRaw: r.godRaw,
        resolvedPlayerId: resolved.id,
        playerConfidence: resolved.confidence,
        resolvedGodId: r.resolvedGodId ?? resolveGod(r.godRaw, gods),
        kills: r.kills,
        deaths: r.deaths,
        assists: r.assists,
        damage: r.damageDealt,
        damageMitigated: r.damageMitigated,
        healing: r.healing,
        structureDamage: r.structureDamage,
        include: true,
      };
    }));
  }, [extraction, orderTeamId, selectedMatch, gods]);

  const loadFile = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      setScreenshot({
        base64: dataUrl.split(',')[1],
        mimeType: file.type,
        previewUrl: dataUrl,
      });
    };
    reader.readAsDataURL(file);
  }, []);

  // Global paste handler
  useEffect(() => {
    const onPaste = (e) => {
      if (!showForm) return;
      for (const item of e.clipboardData?.items ?? []) {
        if (item.type.startsWith('image/')) { loadFile(item.getAsFile()); break; }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [showForm, loadFile]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    loadFile(file);
  }, [loadFile]);

  const handleExtract = async () => {
    if (!selectedGameId || !screenshot) return;
    setExtracting(true);
    setExtraction(null);
    setReviewRows(null);
    setOrderTeamId(null);
    setWinnerTeamId(null);
    setSubmitError(null);
    try {
      const res = await fetch('/api/ocr/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: selectedGameId, imageBase64: screenshot.base64, mimeType: screenshot.mimeType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Extraction failed');
      setExtraction(data);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setExtracting(false);
    }
  };

  const handleSubmit = async () => {
    if (!extraction || !orderTeamId || !winnerTeamId || !reviewRows) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/ocr/${extraction.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderTeamId, winnerTeamId, rows: reviewRows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Submit failed');
      // Prepend to extractions list and reset form
      setExtractions(prev => [{ ...extraction, rows: extraction.rows }, ...prev]);
      setShowForm(false);
      setScreenshot(null);
      setExtraction(null);
      setReviewRows(null);
      setOrderTeamId(null);
      setWinnerTeamId(null);
      setSelectedGameId('');
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setScreenshot(null);
    setExtraction(null);
    setReviewRows(null);
    setOrderTeamId(null);
    setWinnerTeamId(null);
    setSelectedGameId('');
    setSubmitError(null);
  };

  return (
    <div className="min-h-screen bg-brand-900 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-ui text-2xl uppercase tracking-widest text-frh-yellow">Match Report</h1>
            <p className="font-mono text-xs text-gray-500 mt-1">Details tab screenshot → AI extract → review → submit</p>
          </div>
          <div className="flex gap-2">
            <BrutalButton href="/admin" variant="secondary" size="sm">← Admin</BrutalButton>
            {!showForm && (
              <BrutalButton onClick={() => setShowForm(true)} size="sm">+ New Game Report</BrutalButton>
            )}
          </div>
        </div>

        {showForm && (
          <RetroWindow title="New Game Report" titleBarColor="yellow">
            <div className="space-y-4">
              {/* Match + Game selectors */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-ui text-[10px] uppercase tracking-widest text-gray-400 block mb-1">Match</label>
                  <select
                    value={selectedMatchId}
                    onChange={e => { setSelectedMatchId(e.target.value); setSelectedGameId(''); setExtraction(null); setReviewRows(null); }}
                    className="w-full bg-brand-700 border border-gray-600 text-gray-200 font-mono text-xs px-2 py-1.5 rounded"
                  >
                    <option value="">Select match...</option>
                    {matches.map(m => (
                      <option key={m.id} value={m.id}>
                        Wk{m.week}: {m.homeTeam.tag} vs {m.awayTeam.tag} ({m.format})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-ui text-[10px] uppercase tracking-widest text-gray-400 block mb-1">Game</label>
                  <select
                    value={selectedGameId}
                    onChange={e => { setSelectedGameId(e.target.value); setExtraction(null); setReviewRows(null); }}
                    disabled={!selectedMatchId}
                    className="w-full bg-brand-700 border border-gray-600 text-gray-200 font-mono text-xs px-2 py-1.5 rounded disabled:opacity-40"
                  >
                    <option value="">Select game...</option>
                    {selectedMatch?.games.map(g => (
                      <option key={g.id} value={g.id}>
                        Game {g.gameNumber}{g.winnerTeamId ? ' ✓' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Screenshot drop zone */}
              <div>
                <label className="font-ui text-[10px] uppercase tracking-widest text-gray-400 block mb-1">
                  Details Tab Screenshot
                </label>
                <div
                  ref={dropRef}
                  onDrop={handleDrop}
                  onDragOver={e => e.preventDefault()}
                  className="border-2 border-dashed border-gray-600 rounded p-4 text-center cursor-pointer hover:border-frh-yellow transition-colors"
                  onClick={() => document.getElementById('screenshot-input').click()}
                >
                  {screenshot ? (
                    <div className="space-y-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={screenshot.previewUrl} alt="Screenshot preview" className="max-h-32 mx-auto rounded border border-gray-700" />
                      <p className="font-mono text-xs text-frh-yellow">Screenshot loaded — ready to extract</p>
                    </div>
                  ) : (
                    <p className="font-mono text-xs text-gray-500">
                      Drop screenshot here, click to browse, or <kbd className="bg-brand-700 px-1 rounded">Ctrl+V</kbd> to paste
                    </p>
                  )}
                </div>
                <input
                  id="screenshot-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => loadFile(e.target.files?.[0])}
                />
              </div>

              <div className="flex gap-2">
                <BrutalButton
                  onClick={handleExtract}
                  disabled={!selectedGameId || !screenshot || extracting}
                  size="sm"
                >
                  {extracting ? 'Extracting...' : 'Extract Stats'}
                </BrutalButton>
                <BrutalButton onClick={resetForm} variant="secondary" size="sm">Cancel</BrutalButton>
              </div>

              {submitError && (
                <p className="font-mono text-xs text-ember-400 border border-ember-600 bg-ember-900/30 px-3 py-2 rounded">
                  {submitError}
                </p>
              )}
            </div>
          </RetroWindow>
        )}

        {/* Review panel — shown after extraction */}
        {extraction && selectedMatch && (
          <ExtractionReviewPanel
            match={selectedMatch}
            game={selectedGame}
            gods={gods}
            rows={reviewRows}
            onRowsChange={setReviewRows}
            orderTeamId={orderTeamId}
            onOrderTeamChange={(id) => { setOrderTeamId(id); setWinnerTeamId(null); }}
            winnerTeamId={winnerTeamId}
            onWinnerChange={setWinnerTeamId}
            onSubmit={handleSubmit}
            submitting={submitting}
            error={submitError}
          />
        )}

        {/* Extraction history */}
        {extractions.length > 0 && (
          <RetroWindow title={`Recent Extractions (${extractions.length})`} titleBarColor="blue">
            <div className="space-y-1">
              {extractions.map(ex => {
                const g = ex.game;
                const label = g
                  ? `Wk${g.match.week}: ${g.match.homeTeam.tag} vs ${g.match.awayTeam.tag} — Game ${g.gameNumber}`
                  : 'Unlinked';
                const approved = ex.rows.filter(r => r.status === 'approved').length;
                const pending = ex.rows.filter(r => r.status === 'pending').length;
                return (
                  <div key={ex.id} className="flex items-center justify-between px-3 py-2 bg-brand-700 rounded font-mono text-xs">
                    <span className="text-gray-300">{label}</span>
                    <div className="flex items-center gap-3 text-gray-500">
                      {approved > 0 && <span className="text-green-400">{approved} approved</span>}
                      {pending > 0 && <span className="text-frh-yellow">{pending} pending</span>}
                      <span className={
                        ex.status === 'completed' ? 'text-green-400' :
                        ex.status === 'failed' ? 'text-ember-400' : 'text-gray-400'
                      }>{ex.status}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </RetroWindow>
        )}
      </div>
    </div>
  );
}
