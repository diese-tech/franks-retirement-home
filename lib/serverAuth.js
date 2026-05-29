import { cookies } from 'next/headers';
import { getDiscordSessionFromRaw, hasDiscordAdminRole } from './discordAuth';

/**
 * Checks if the current request (via next/headers cookies) belongs to a
 * Discord admin. Safe to call from server components and server actions.
 * Do NOT import this in API route handlers — use resolveAdminAuth() instead.
 * @returns {boolean}
 */
export function isDiscordAdminFromCookies() {
  const raw = cookies().get('frh_discord_session')?.value ?? null;
  if (!raw) return false;
  const user = getDiscordSessionFromRaw(raw);
  return user ? hasDiscordAdminRole(user.roles) : false;
}

/**
 * Server-side helper: returns true if a valid Discord session cookie is present.
 * Intended for use in Server Components and page.js files.
 *
 * @returns {boolean}
 */
export function hasDiscordSession() {
  const raw = cookies().get('frh_discord_session')?.value ?? null;
  if (!raw) return false;
  const user = getDiscordSessionFromRaw(raw);
  return user !== null;
}
