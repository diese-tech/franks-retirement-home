import { getDiscordSessionUser, hasDiscordAdminRole, resolveCaptainSideFromDiscord, resolveDraftRoleFromDiscord } from '@/lib/discordAuth';
import { resolveCaptainSide } from '@/lib/matchWindow';
import { resolveRole } from '@/lib/draftAuth';
import { requireAdmin } from '@/lib/adminSession';

/**
 * Resolves captain auth for match-scoped actions.
 * Tries Discord session first, falls back to X-Captain-Key header.
 * @param {Request} request
 * @param {object} match - must include { id, homeTeamCaptainKey, awayTeamCaptainKey }
 * @returns {Promise<{ side: 'home'|'away'|null, source: 'discord'|'key'|null, isAdmin: boolean }>}
 */
export async function resolveMatchCaptainAuth(request, match) {
  // Try Discord session first
  const session = getDiscordSessionUser(request);
  if (session) {
    if (hasDiscordAdminRole(session.roles)) {
      return { side: null, source: 'discord', isAdmin: true };
    }
    const side = await resolveCaptainSideFromDiscord(match.id, session.roles);
    if (side) {
      return { side, source: 'discord', isAdmin: false };
    }
    // Discord session present but not authorized for this match - still try key fallback
  }

  // Fallback to captain key
  const captainKey = request.headers?.get('x-captain-key') ?? null;
  const side = resolveCaptainSide(match, captainKey);
  if (side) {
    return { side, source: 'key', isAdmin: false };
  }

  return { side: null, source: null, isAdmin: false };
}

/**
 * Resolves captain auth for draft-scoped actions.
 * Tries Discord session first, falls back to body.key.
 * @param {Request} request
 * @param {object} draft - must include { id, adminKey, captainAKey, captainBKey }
 * @param {string|null} bodyKey - the key from request body (already parsed by caller)
 * @returns {Promise<{ role: 'admin'|'captainA'|'captainB'|'spectator', source: 'discord'|'key' }>}
 */
export async function resolveDraftCaptainAuth(request, draft, bodyKey) {
  // Try Discord session first
  const session = getDiscordSessionUser(request);
  if (session) {
    const role = await resolveDraftRoleFromDiscord(draft.id, session.roles);
    if (role !== 'spectator') {
      return { role, source: 'discord' };
    }
    // Discord session present but not a captain/admin for this draft - try key fallback
  }

  // Fallback to key
  const role = resolveRole(bodyKey, draft);
  return { role, source: 'key' };
}

/**
 * Resolves admin auth.
 * Tries Discord admin role first, falls back to existing requireAdmin().
 * @param {Request} request
 * @returns {Promise<null|Response>} null if authorized, NextResponse 401 if not
 */
export async function resolveAdminAuth(request) {
  // Try Discord session with admin role first
  const session = getDiscordSessionUser(request);
  if (session && hasDiscordAdminRole(session.roles)) {
    return null; // authorized
  }

  // Fallback to existing admin session
  return requireAdmin(request);
}
