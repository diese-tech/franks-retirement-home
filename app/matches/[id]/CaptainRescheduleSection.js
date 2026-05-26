'use client';

import { useState, useEffect, useCallback } from 'react';

const STATUS_LABEL = {
  pending:      'Awaiting opposing captain',
  acknowledged: 'Acknowledged — pending admin review',
  disputed:     'Disputed — pending admin review',
  approved:     'Approved',
  denied:       'Denied',
};

const STATUS_COLOR = {
  pending:      'text-frh-yellow',
  acknowledged: 'text-frh-lime',
  disputed:     'text-orange-400',
  approved:     'text-frh-lime',
  denied:       'text-gray-500',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function apiFetch(url, opts = {}) {
  const res = await fetch(url, { ...opts, credentials: 'same-origin' });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

function postJson(url, body, headers = {}) {
  return apiFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

function patchJson(url, body, headers = {}) {
  return apiFetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * CaptainRescheduleSection
 *
 * Props:
 *   matchId       {string}
 *   captainKey    {string}   — the URL-provided captain key
 *   captainSide   {'home'|'away'}
 */
export default function CaptainRescheduleSection({ matchId, captainKey, captainSide }) {
  const [requests, setRequests]         = useState([]);
  const [loading, setLoading]           = useState(true);

  // New-request form state
  const [proposedAt, setProposedAt]     = useState('');
  const [evidenceText, setEvidenceText] = useState('');
  const [submitting, setSubmitting]     = useState(false);
  const [submitErr, setSubmitErr]       = useState('');
  const [submitOk, setSubmitOk]         = useState(false);

  // Opposing-captain response state
  const [responseNote, setResponseNote] = useState('');
  const [responding, setResponding]     = useState(false);
  const [respondErr, setRespondErr]     = useState('');

  const loadRequests = useCallback(async () => {
    setLoading(true);
    // Captains fetch via the captain-key header — the GET endpoint is admin-only,
    // so we use a lightweight check: just list the match's open request by POST
    // round-tripping? No — instead we expose a captain-readable endpoint via
    // the same GET but keyed. Since GET is admin-only, captains see their
    // relevant state embedded in the page on load (passed as initialRequests).
    // Here we re-fetch with the captain key so the state stays live after actions.
    const headers = {};
    if (captainKey) {
      headers['x-captain-key'] = captainKey;
    }
    const { ok, data } = await apiFetch(`/api/matches/${matchId}/reschedule-requests`, {
      headers,
    });
    setRequests(ok && Array.isArray(data) ? data : []);
    setLoading(false);
  }, [matchId, captainKey]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  // The single open request for this match (if any).
  const openRequest = requests.find((r) => !['approved', 'denied'].includes(r.status));
  // All resolved requests for history display.
  const resolvedRequests = requests.filter((r) => ['approved', 'denied'].includes(r.status));

  // ── Submit new request ──────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitErr('');
    setSubmitOk(false);
    if (!proposedAt) { setSubmitErr('Please select a proposed date and time.'); return; }
    setSubmitting(true);
    const headers = {};
    if (captainKey) {
      headers['x-captain-key'] = captainKey;
    }
    const { ok, data } = await postJson(
      `/api/matches/${matchId}/reschedule-requests`,
      { proposedScheduledAt: new Date(proposedAt).toISOString(), evidenceText: evidenceText.trim() || undefined },
      headers,
    );
    setSubmitting(false);
    if (!ok) { setSubmitErr(data.error ?? 'Failed to submit request.'); return; }
    setSubmitOk(true);
    setProposedAt('');
    setEvidenceText('');
    await loadRequests();
  };

  // ── Opposing captain response ───────────────────────────────────────────────
  const handleRespond = async (action) => {
    if (!openRequest) return;
    setRespondErr('');
    setResponding(true);
    const headers = {};
    if (captainKey) {
      headers['x-captain-key'] = captainKey;
    }
    const { ok, data } = await patchJson(
      `/api/matches/${matchId}/reschedule-requests/${openRequest.id}`,
      { action, note: responseNote.trim() || undefined },
      headers,
    );
    setResponding(false);
    if (!ok) { setRespondErr(data.error ?? 'Failed to respond.'); return; }
    setResponseNote('');
    await loadRequests();
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="border-t-2 border-frh-border pt-6 mt-6 space-y-4">
      <h2 className="font-ui text-xs uppercase tracking-widest text-frh-text-muted">
        Reschedule Request
      </h2>
      <p className="font-mono text-[10px] text-gray-600">
        Propose a new match time. The opposing captain must acknowledge and an admin must approve before
        the schedule updates. The eligibility window is based on the original scheduled date and does not change.
      </p>

      {loading && <p className="text-[10px] text-gray-500">Loading…</p>}

      {/* ── Open request display ─────────────────────────────────────────── */}
      {!loading && openRequest && (
        <div className="border-2 border-frh-border bg-frh-base/40 p-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-ui text-xs uppercase text-gray-400">Open Request</span>
            <span className={`font-mono text-[10px] uppercase ${STATUS_COLOR[openRequest.status] ?? 'text-gray-400'}`}>
              {STATUS_LABEL[openRequest.status] ?? openRequest.status}
            </span>
          </div>

          <div className="text-xs text-frh-text">
            <span className="text-gray-600 font-ui uppercase text-[10px]">Proposed: </span>
            {new Date(openRequest.proposedScheduledAt).toLocaleString()}
          </div>

          {openRequest.evidenceText && (
            <div className="text-[11px] text-gray-400 bg-brand-900/40 px-2 py-1 border border-brand-700">
              <span className="text-gray-600 font-ui uppercase text-[10px]">Evidence: </span>
              {openRequest.evidenceText}
            </div>
          )}

          {openRequest.opposingCaptainNote && (
            <div className="text-[11px] text-gray-400 bg-brand-900/40 px-2 py-1 border border-brand-700">
              <span className="text-gray-600 font-ui uppercase text-[10px]">Opposing captain note: </span>
              {openRequest.opposingCaptainNote}
            </div>
          )}

          {/* Opposing captain can ack/dispute a pending request */}
          {openRequest.status === 'pending' && openRequest.requestedByCaptainSide !== captainSide && (
            <div className="pt-2 space-y-2">
              <p className="font-ui text-[10px] uppercase text-gray-500">Your response</p>
              <textarea
                value={responseNote}
                onChange={(e) => setResponseNote(e.target.value)}
                placeholder="Optional note to accompany your response…"
                rows={2}
                className="input-field w-full text-xs resize-none"
                disabled={responding}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleRespond('acknowledge')}
                  disabled={responding}
                  className="flex-1 py-1.5 font-ui text-xs uppercase tracking-wide border-2 border-frh-lime text-frh-lime hover:bg-frh-lime/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {responding ? '…' : 'Acknowledge'}
                </button>
                <button
                  onClick={() => handleRespond('dispute')}
                  disabled={responding}
                  className="flex-1 py-1.5 font-ui text-xs uppercase tracking-wide border-2 border-orange-500 text-orange-400 hover:bg-orange-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {responding ? '…' : 'Dispute'}
                </button>
              </div>
              {respondErr && <p className="font-mono text-[10px] text-red-400">{respondErr}</p>}
            </div>
          )}

          {/* Requester sees a waiting message */}
          {openRequest.status === 'pending' && openRequest.requestedByCaptainSide === captainSide && (
            <p className="font-mono text-[10px] text-gray-500">
              Waiting for the opposing captain to respond.
            </p>
          )}

          {(openRequest.status === 'acknowledged' || openRequest.status === 'disputed') && (
            <p className="font-mono text-[10px] text-gray-500">
              Pending admin review.
            </p>
          )}
        </div>
      )}

      {/* ── New request form — only shown when no open request exists ───── */}
      {!loading && !openRequest && (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-[10px] font-ui uppercase text-gray-600 mb-1">
              Proposed Date &amp; Time
            </label>
            <input
              type="datetime-local"
              value={proposedAt}
              onChange={(e) => setProposedAt(e.target.value)}
              className="input-field w-full text-xs"
              disabled={submitting}
              required
            />
          </div>
          <div>
            <label className="block text-[10px] font-ui uppercase text-gray-600 mb-1">
              Evidence (Discord link, summary, etc.)
            </label>
            <textarea
              value={evidenceText}
              onChange={(e) => setEvidenceText(e.target.value)}
              placeholder="Paste a Discord link or summarise the agreed time here…"
              rows={3}
              className="input-field w-full text-xs resize-none"
              disabled={submitting}
            />
          </div>

          {submitErr && <p className="font-mono text-[10px] text-red-400">{submitErr}</p>}
          {submitOk  && <p className="font-mono text-[10px] text-frh-lime">Request submitted. Awaiting opposing captain.</p>}

          <button
            type="submit"
            disabled={submitting || !proposedAt}
            className="w-full py-1.5 font-ui text-xs uppercase tracking-wide border-2 border-frh-yellow text-frh-yellow hover:bg-frh-yellow/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? 'Submitting…' : 'Submit Reschedule Request'}
          </button>
        </form>
      )}

      {/* ── Resolved history ─────────────────────────────────────────────── */}
      {!loading && resolvedRequests.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-ui uppercase text-gray-600">Previous Requests</p>
          {resolvedRequests.map((r) => (
            <div key={r.id} className="flex flex-wrap gap-2 items-center px-2 py-1.5 border border-brand-700 text-[10px]">
              <span className="font-mono text-gray-400">
                {new Date(r.proposedScheduledAt).toLocaleString()}
              </span>
              <span className={`font-ui uppercase ${STATUS_COLOR[r.status] ?? 'text-gray-500'}`}>
                {r.status}
              </span>
              {r.adminNote && (
                <span className="text-gray-500 ml-auto">Admin: {r.adminNote}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
