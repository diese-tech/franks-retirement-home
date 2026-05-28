'use client';

import { useState, useEffect } from 'react';

/**
 * Client hook that resolves the current Discord session.
 * Returns { authState, loading } where authState is:
 *   null (still loading) →
 *   { anonymous: true } if logged out, or
 *   { discordId, username, isAdmin, teamId } if logged in.
 */
export default function useAuth() {
  const [authState, setAuthState] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/discord/me')
      .then((res) => {
        if (!res.ok) return { anonymous: true };
        return res.json();
      })
      .then((data) => { if (!cancelled) setAuthState(data); })
      .catch(() => { if (!cancelled) setAuthState({ anonymous: true }); });
    return () => { cancelled = true; };
  }, []);

  return { authState, loading: authState === null };
}
