// Discord OAuth session helper -- HMAC-signed, HttpOnly cookie auth for
// Discord-authenticated users (captains and admins).
//
// Session cookie format: "<base64url(JSON payload)>.<base64url(HMAC-SHA256)>"
//   - payload contains { discordId, username, roles[], exp }
//   - exp is Unix-ms expiry timestamp
//
// Cookie name: frh_discord_session
// TTL: 24 hours
// Signing secret: DISCORD_SESSION_SECRET (minimum 16 chars)

import { createHmac, timingSafeEqual } from 'node:crypto';
import prisma from '@/lib/db';

export const DISCORD_SESSION_COOKIE = 'frh_discord_session';
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── Environment validation ──────────────────────────────────────────────────

const REQUIRED_ENV_VARS = [
  'DISCORD_CLIENT_ID',
  'DISCORD_CLIENT_SECRET',
  'DISCORD_GUILD_ID',
  'DISCORD_SESSION_SECRET',
];

/**
 * Validates that all required Discord env vars are present.
 * @returns {{ valid: boolean, missing: string[] }}
 */
export function validateDiscordEnv() {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
  return { valid: missing.length === 0, missing };
}

// ─── OAuth URL helpers ───────────────────────────────────────────────────────

/**
 * Builds the Discord OAuth2 authorize URL.
 * Scopes: identify, guilds.members.read
 * @param {string} [returnUrl] - URL to redirect back to after login
 * @returns {string}
 */
export function getDiscordAuthUrl(returnUrl) {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const baseUrl = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000');
  const redirectUri = `${baseUrl}/api/auth/discord/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'identify guilds.members.read',
  });

  if (returnUrl) {
    params.set('state', returnUrl);
  }

  return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
}

// ─── Discord API interactions ────────────────────────────────────────────────

/**
 * Exchanges authorization code for tokens via Discord API.
 * POST https://discord.com/api/v10/oauth2/token
 * @param {string} code
 * @param {string} redirectUri
 * @returns {Promise<{ access_token: string, refresh_token: string, expires_in: number }>}
 */
export async function exchangeCode(code, redirectUri) {
  const res = await fetch('https://discord.com/api/v10/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      client_secret: process.env.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Discord token exchange failed (${res.status}): ${text}`);
  }

  return res.json();
}

/**
 * Fetches user profile from GET https://discord.com/api/v10/users/@me
 * @param {string} accessToken
 * @returns {Promise<{ id: string, username: string, discriminator: string, avatar: string|null }>}
 */
export async function getDiscordUser(accessToken) {
  const res = await fetch('https://discord.com/api/v10/users/@me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Discord user fetch failed (${res.status})`);
  }

  return res.json();
}

/**
 * Fetches guild member (including roles) from Discord API.
 * GET https://discord.com/api/v10/users/@me/guilds/{guildId}/member
 * @param {string} accessToken
 * @param {string} guildId
 * @returns {Promise<{ roles: string[], nick: string|null, ... }>}
 */
export async function getDiscordGuildMember(accessToken, guildId) {
  const res = await fetch(
    `https://discord.com/api/v10/users/@me/guilds/${guildId}/member`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!res.ok) {
    if (res.status === 404 || res.status === 403) return null;
    throw new Error(`Discord guild member fetch failed (${res.status})`);
  }

  return res.json();
}

// ─── Session cookie (HMAC-signed JSON) ───────────────────────────────────────

function getSessionSecret() {
  const secret = process.env.DISCORD_SESSION_SECRET;
  if (!secret || secret.length < 16) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('DISCORD_SESSION_SECRET must be set (minimum 16 chars) in production');
    }
    return secret || 'dev-only-discord-insecure-secret';
  }
  return secret;
}

function base64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlEncode(str) {
  return base64url(Buffer.from(str, 'utf8'));
}

function base64urlDecode(str) {
  // Restore standard base64 padding
  let s = str.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64').toString('utf8');
}

function hmacSign(payload, secret) {
  return base64url(createHmac('sha256', secret).update(payload).digest());
}

/**
 * Builds a signed session cookie value.
 *
 * NOTE: Roles are captured at login time and frozen for the session TTL (24h).
 * Discord role changes (captain removal, team reassignment) are not reflected
 * until re-login. This is a known trade-off for simplicity. Consider adding
 * a role-refresh mechanism on sensitive actions if operational cadence requires it.
 *
 * @param {{ discordId: string, username: string, roles: string[] }} sessionData
 * @returns {string} cookie value
 */
export function buildDiscordSessionCookie(sessionData) {
  const secret = getSessionSecret();
  const payload = JSON.stringify({
    discordId: sessionData.discordId,
    username: sessionData.username,
    roles: sessionData.roles,
    exp: Date.now() + SESSION_TTL_MS,
  });
  const encoded = base64urlEncode(payload);
  const signature = hmacSign(encoded, secret);
  return `${encoded}.${signature}`;
}

/**
 * Builds a Set-Cookie header string for the Discord session.
 * @param {string} cookieValue - signed cookie value from buildDiscordSessionCookie
 * @returns {string}
 */
export function buildSetCookieHeader(cookieValue) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  const maxAgeSec = Math.floor(SESSION_TTL_MS / 1000);
  return `${DISCORD_SESSION_COOKIE}=${cookieValue}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secure}`;
}

/**
 * Builds a Set-Cookie header to clear the discord session.
 * @returns {string}
 */
export function clearDiscordSessionCookie() {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${DISCORD_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

/**
 * Verifies and decodes a raw frh_discord_session cookie value.
 * Accepts the raw cookie value string (without the cookie name/prefix).
 * Returns { discordId, username, roles } or null if invalid/missing/expired.
 * @param {string|null|undefined} cookieValue
 * @returns {{ discordId: string, username: string, roles: string[] } | null}
 */
export function getDiscordSessionFromRaw(cookieValue) {
  if (!cookieValue) return null;

  const dotIndex = cookieValue.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex === cookieValue.length - 1) return null;

  const encoded = cookieValue.slice(0, dotIndex);
  const providedSig = cookieValue.slice(dotIndex + 1);

  // Verify HMAC
  const secret = getSessionSecret();
  const expectedSig = hmacSign(encoded, secret);

  let expectedBuf, providedBuf;
  try {
    expectedBuf = Buffer.from(expectedSig);
    providedBuf = Buffer.from(providedSig);
  } catch {
    return null;
  }
  if (expectedBuf.length !== providedBuf.length) return null;
  if (!timingSafeEqual(expectedBuf, providedBuf)) return null;

  // Decode payload
  let payload;
  try {
    payload = JSON.parse(base64urlDecode(encoded));
  } catch {
    return null;
  }

  // Check expiry
  if (!payload.exp || Date.now() > payload.exp) return null;

  if (!payload.discordId || !payload.username || !Array.isArray(payload.roles)) return null;

  return {
    discordId: payload.discordId,
    username: payload.username,
    roles: payload.roles,
  };
}

/**
 * Reads and verifies the frh_discord_session cookie from a request.
 * Returns { discordId, username, roles } or null if invalid/missing/expired.
 * @param {Request} request
 * @returns {{ discordId: string, username: string, roles: string[] } | null}
 */
export function getDiscordSessionUser(request) {
  const header = request.headers?.get('cookie');
  if (!header) return null;

  let cookieValue = null;
  const parts = header.split(';');
  for (const part of parts) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    if (name === DISCORD_SESSION_COOKIE) {
      cookieValue = part.slice(eq + 1).trim();
      break;
    }
  }

  return getDiscordSessionFromRaw(cookieValue);
}

// ─── Role-based authorization helpers ────────────────────────────────────────

/**
 * Checks if the roles array includes DISCORD_ADMIN_ROLE_ID.
 * @param {string[]} roles
 * @returns {boolean}
 */
export function hasDiscordAdminRole(roles) {
  const adminRoleId = process.env.DISCORD_ADMIN_ROLE_ID;
  if (!adminRoleId) return false;
  return roles.includes(adminRoleId);
}

/**
 * Checks if roles include either per-division captain role ID.
 * (DISCORD_HOSPICE_CAPTAIN_ROLE_ID or DISCORD_REHABILITATION_CAPTAIN_ROLE_ID)
 * @param {string[]} roles
 * @returns {boolean}
 */
export function hasDiscordCaptainRole(roles) {
  const hospiceCaptainRoleId = process.env.DISCORD_HOSPICE_CAPTAIN_ROLE_ID;
  const rehabCaptainRoleId = process.env.DISCORD_REHABILITATION_CAPTAIN_ROLE_ID;
  if (hospiceCaptainRoleId && roles.includes(hospiceCaptainRoleId)) return true;
  if (rehabCaptainRoleId && roles.includes(rehabCaptainRoleId)) return true;
  return false;
}

/**
 * Parses a comma-separated env var into an array of role IDs.
 * @param {string|undefined} envValue
 * @returns {string[]}
 */
function parseRoleIds(envValue) {
  if (!envValue) return [];
  return envValue.split(',').map((id) => id.trim()).filter(Boolean);
}

/**
 * Checks if user has any player role from either division's player role list.
 * @param {string[]} roles
 * @returns {boolean}
 */
export function hasDiscordPlayerRole(roles) {
  const hospicePlayerRoleIds = parseRoleIds(process.env.DISCORD_HOSPICE_PLAYER_ROLE_IDS);
  const rehabPlayerRoleIds = parseRoleIds(process.env.DISCORD_REHABILITATION_PLAYER_ROLE_IDS);
  for (const id of hospicePlayerRoleIds) {
    if (roles.includes(id)) return true;
  }
  for (const id of rehabPlayerRoleIds) {
    if (roles.includes(id)) return true;
  }
  return false;
}

/**
 * Resolves division based on player roles only (not captain roles).
 * @param {string[]} roles
 * @returns {'div-s9-hospice' | 'div-s9-rehabilitation' | null}
 */
export function resolvePlayerDivisionFromRoles(roles) {
  const hospicePlayerRoleIds = parseRoleIds(process.env.DISCORD_HOSPICE_PLAYER_ROLE_IDS);
  const rehabPlayerRoleIds = parseRoleIds(process.env.DISCORD_REHABILITATION_PLAYER_ROLE_IDS);
  for (const id of hospicePlayerRoleIds) {
    if (roles.includes(id)) return 'div-s9-hospice';
  }
  for (const id of rehabPlayerRoleIds) {
    if (roles.includes(id)) return 'div-s9-rehabilitation';
  }
  return null;
}

/**
 * Given roles array, finds which team ID the user belongs to by checking DISCORD_TEAM_ROLE_MAP_JSON.
 * @param {string[]} roles
 * @returns {string|null} the FRH team ID or null
 */
export function resolveTeamFromRoles(roles) {
  const mapJson = process.env.DISCORD_TEAM_ROLE_MAP_JSON;
  if (!mapJson) return null;

  let teamRoleMap;
  try {
    teamRoleMap = JSON.parse(mapJson);
  } catch {
    return null;
  }

  // teamRoleMap is { "team-id": "discord-role-id", ... }
  for (const [teamId, discordRoleId] of Object.entries(teamRoleMap)) {
    if (roles.includes(discordRoleId)) return teamId;
  }
  return null;
}

/**
 * Given roles array, resolves division membership.
 * Priority: captain role (implies division), then player roles as fallback.
 * @param {string[]} roles
 * @returns {'div-s9-hospice' | 'div-s9-rehabilitation' | null}
 */
export function resolveDivisionFromRoles(roles) {
  // Captain roles imply division directly
  const hospiceCaptainRoleId = process.env.DISCORD_HOSPICE_CAPTAIN_ROLE_ID;
  const rehabCaptainRoleId = process.env.DISCORD_REHABILITATION_CAPTAIN_ROLE_ID;

  if (hospiceCaptainRoleId && roles.includes(hospiceCaptainRoleId)) return 'div-s9-hospice';
  if (rehabCaptainRoleId && roles.includes(rehabCaptainRoleId)) return 'div-s9-rehabilitation';

  // Fallback: player roles
  return resolvePlayerDivisionFromRoles(roles);
}

// ─── Match/Draft resolution ──────────────────────────────────────────────────

/**
 * Given a matchId and user's Discord roles, queries the match homeTeam/awayTeam,
 * checks captain role + team role + division role to determine 'home' | 'away' | null.
 *
 * A user may perform captain actions only if they have ALL of:
 *   - captain role
 *   - team role (matching homeTeam or awayTeam)
 *   - division role matching the team's divisionId
 *
 * @param {string} matchId
 * @param {string[]} userRoles
 * @returns {Promise<'home'|'away'|null>}
 */
export async function resolveCaptainSideFromDiscord(matchId, userRoles) {
  if (!hasDiscordCaptainRole(userRoles)) return null;

  const teamId = resolveTeamFromRoles(userRoles);
  if (!teamId) return null;

  const userDivision = resolveDivisionFromRoles(userRoles);
  if (!userDivision) return null;

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      homeTeamId: true,
      awayTeamId: true,
      homeTeam: { select: { divisionId: true } },
      awayTeam: { select: { divisionId: true } },
    },
  });

  if (!match) return null;

  if (match.homeTeamId === teamId && match.homeTeam.divisionId === userDivision) {
    return 'home';
  }
  if (match.awayTeamId === teamId && match.awayTeam.divisionId === userDivision) {
    return 'away';
  }

  return null;
}

/**
 * Given a draftId and user's Discord roles, resolves 'admin' | 'captainA' | 'captainB' | 'spectator'.
 *
 * Traces: draft -> game -> match -> homeTeam/awayTeam -> team role check
 * For standalone drafts (no gameId), returns 'spectator'.
 *
 * @param {string} draftId
 * @param {string[]} userRoles
 * @returns {Promise<'admin'|'captainA'|'captainB'|'spectator'>}
 */
export async function resolveDraftRoleFromDiscord(draftId, userRoles) {
  // Admin role overrides all checks
  if (hasDiscordAdminRole(userRoles)) return 'admin';

  const draft = await prisma.draft.findUnique({
    where: { id: draftId },
    select: {
      gameId: true,
      game: {
        select: {
          match: {
            select: {
              id: true,
              homeTeamId: true,
              awayTeamId: true,
              homeTeam: { select: { divisionId: true } },
              awayTeam: { select: { divisionId: true } },
            },
          },
        },
      },
    },
  });

  if (!draft) return 'spectator';

  // Standalone drafts (no game link) cannot resolve captain identity via Discord
  if (!draft.gameId || !draft.game || !draft.game.match) return 'spectator';

  if (!hasDiscordCaptainRole(userRoles)) return 'spectator';

  const teamId = resolveTeamFromRoles(userRoles);
  if (!teamId) return 'spectator';

  const userDivision = resolveDivisionFromRoles(userRoles);
  if (!userDivision) return 'spectator';

  const match = draft.game.match;

  if (match.homeTeamId === teamId && match.homeTeam.divisionId === userDivision) {
    return 'captainA';
  }
  if (match.awayTeamId === teamId && match.awayTeam.divisionId === userDivision) {
    return 'captainB';
  }

  return 'spectator';
}
