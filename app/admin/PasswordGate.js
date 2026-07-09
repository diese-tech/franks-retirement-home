'use client';

import { useState } from 'react';
import { RetroWindow, BrutalButton } from '@/components/ui';

// Standalone login gate rendered by admin page server components when the
// request has no valid admin session (Discord admin or password cookie).
// On success the POST sets the HttpOnly session cookie, then a full reload
// lets the server component re-render with admin data.
export default function PasswordGate() {
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
    }).catch(() => null);
    if (res?.ok) {
      window.location.reload();
    } else {
      setError(res?.status === 429 ? 'Too many attempts. Try again in a few minutes.' : 'Incorrect password');
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <RetroWindow title="AUTHENTICATION REQUIRED" titleBarColor="blue" className="w-full max-w-sm">
        <h1 className="font-ui text-sm uppercase tracking-widest text-frh-yellow mb-1">Admin Access</h1>
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
          <BrutalButton type="submit" disabled={busy || !pw} className="w-full">
            {busy ? 'Checking...' : 'Enter the Compound'}
          </BrutalButton>
        </form>
      </RetroWindow>
    </div>
  );
}
