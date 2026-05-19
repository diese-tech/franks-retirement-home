import prisma from '@/lib/db';

// Module-scope TTL cache for the small, mostly-static reference tables that
// every SSE state push currently re-reads. With many concurrent viewers this
// was the most expensive part of the system. The cache has explicit
// invalidation hooks called from the players/gods mutation endpoints, so a
// fresh admin write is reflected immediately. The TTL is the safety net.

const TTL_MS = 30_000;

const state = {
  players: { value: null, expiresAt: 0 },
  gods: { value: null, expiresAt: 0 },
};

async function get(kind, loader) {
  const slot = state[kind];
  const now = Date.now();
  if (slot.value !== null && slot.expiresAt > now) return slot.value;
  const value = await loader();
  slot.value = value;
  slot.expiresAt = now + TTL_MS;
  return value;
}

export async function getPlayers() {
  return get('players', () => prisma.player.findMany({ orderBy: { name: 'asc' } }));
}

export async function getGods() {
  return get('gods', () => prisma.god.findMany({ orderBy: { name: 'asc' } }));
}

export function invalidatePlayers() {
  state.players.value = null;
  state.players.expiresAt = 0;
}

export function invalidateGods() {
  state.gods.value = null;
  state.gods.expiresAt = 0;
}
