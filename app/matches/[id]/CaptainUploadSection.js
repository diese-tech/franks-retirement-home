'use client';

import { useState, useRef, useCallback } from 'react';

function GameUploadZone({ game, captainKey }) {
  const [screenshot, setScreenshot] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null); // { ok, extractionId } or { error }
  const inputRef = useRef(null);

  const loadFile = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      setScreenshot({ base64: dataUrl.split(',')[1], mimeType: file.type, previewUrl: dataUrl });
      setResult(null);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    loadFile(e.dataTransfer.files?.[0]);
  }, [loadFile]);

  const handleUpload = async () => {
    if (!screenshot) return;
    setUploading(true);
    setResult(null);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (captainKey) {
        headers['X-Captain-Key'] = captainKey;
      }
      const res = await fetch('/api/ocr/extract', {
        method: 'POST',
        headers,
        body: JSON.stringify({ gameId: game.id, imageBase64: screenshot.base64, mimeType: screenshot.mimeType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Upload failed');
      setResult({ ok: true, extractionId: data.extractionId });
    } catch (err) {
      setResult({ error: err.message });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="border-2 border-brand-700 bg-brand-950/40 p-4 rounded">
      <div className="flex items-center justify-between mb-3">
        <span className="font-ui text-xs uppercase tracking-widest text-gray-400">
          Game {game.gameNumber}
        </span>
        {game.winnerTeamId && (
          <span className="font-mono text-[10px] text-frh-lime">Result recorded</span>
        )}
      </div>

      {result?.ok ? (
        <div className="text-center py-4">
          <p className="font-ui text-sm text-frh-lime uppercase tracking-wide">Screenshot submitted</p>
          <p className="font-mono text-[10px] text-gray-500 mt-1">Awaiting admin review</p>
        </div>
      ) : (
        <>
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            className="border-2 border-dashed border-gray-600 rounded p-3 text-center cursor-pointer hover:border-frh-yellow transition-colors mb-3"
            onClick={() => inputRef.current?.click()}
          >
            {screenshot ? (
              <div className="space-y-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={screenshot.previewUrl} alt="Screenshot preview" className="max-h-24 mx-auto rounded border border-gray-700" />
                <p className="font-mono text-[10px] text-frh-yellow">Screenshot loaded</p>
              </div>
            ) : (
              <p className="font-mono text-[10px] text-gray-500">Drop image or click to browse</p>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => loadFile(e.target.files?.[0])}
          />

          {result?.error && (
            <p className="font-mono text-[10px] text-ember-400 mb-2">{result.error}</p>
          )}

          <button
            onClick={handleUpload}
            disabled={!screenshot || uploading}
            className="w-full py-1.5 font-ui text-xs uppercase tracking-wide border-2 border-frh-yellow text-frh-yellow hover:bg-frh-yellow/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {uploading ? 'Uploading...' : 'Submit Screenshot'}
          </button>
        </>
      )}
    </div>
  );
}

export default function CaptainUploadSection({ games, captainKey }) {
  return (
    <div className="border-t-2 border-brand-700 pt-6 mt-6">
      <h2 className="font-ui text-xs uppercase tracking-widest text-gray-500 mb-1">Captain Upload</h2>
      <p className="font-mono text-[10px] text-gray-600 mb-4">
        Upload the Details tab screenshot for each game. An admin will review and approve the stats.
      </p>
      <div className="space-y-3">
        {games.map(game => (
          <GameUploadZone key={game.id} game={game} captainKey={captainKey} />
        ))}
      </div>
    </div>
  );
}
