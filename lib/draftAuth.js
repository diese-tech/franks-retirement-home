// Resolves the caller's role from a URL key against a draft record.
// Returns 'admin' | 'captainA' | 'captainB' | 'spectator'.
// An unrecognized key falls back to spectator — prevents key enumeration.
export function resolveRole(key, draft) {
  if (!key) return 'spectator';
  if (draft.adminKey && key === draft.adminKey) return 'admin';
  if (draft.captainAKey && key === draft.captainAKey) return 'captainA';
  if (draft.captainBKey && key === draft.captainBKey) return 'captainB';
  return 'spectator';
}

export const SENDER_INFO = {
  captainA:  { name: 'Captain Alpha', team: 'A' },
  captainB:  { name: 'Captain Bravo', team: 'B' },
  admin:     { name: 'Admin',         team: 'admin' },
  spectator: { name: 'Spectator',     team: 'spectator' },
};
