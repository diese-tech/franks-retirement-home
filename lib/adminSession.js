// Admin session helper — HMAC-signed, HttpOnly cookie auth for the admin
// dashboard and admin-mutating API routes.
//
// Session token format: "<issuedAtMs>.<base64urlHmac>"
//   - issuedAtMs is a base-10 string of the issue timestamp.
//   - base64urlHmac is the HMAC-SHA256 of issuedAtMs with ADMIN_SESSION_SECRET.
//
// The cookie is HttpOnly + SameSite=Lax + Secure (on https deployments) and
// expires after SESSION_TTL_MS. This is intentionally simple — no separate
// session store, no rotating IDs. It is sufficient for a single-admin dashboard
// and mirrors the security guarantees of the current shared password.

import { createHmac, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE_NAME = 'frh_admin_session';
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function getSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 16) {
    // Throw in production; warn in dev so local setup keeps working.
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ADMIN_SESSION_SECRET must be set (minimum 16 chars) in production');
    }
    return secret || 'dev-only-insecure-secret-do-not-use-in-prod';
  }
  return secret;
}

function base64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function sign(payload, secret) {
  return base64url(createHmac('sha256', secret).update(payload).digest());
}

/**
 * Mint a new session token. Caller is responsible for setting it as a cookie.
 */
export function createSessionToken(now = Date.now()) {
  const secret = getSecret();
  const issuedAt = String(now);
  const signature = sign(issuedAt, secret);
  return `${issuedAt}.${signature}`;
}

/**
 * Verify a session token. Returns { valid: true, issuedAt } or { valid: false }.
 */
export function verifySessionToken(token, now = Date.now()) {
  if (typeof token !== 'string' || token.length === 0) return { valid: false };

  const dotIndex = token.indexOf('.');
  if (dotIndex <= 0 || dotIndex === token.length - 1) return { valid: false };

  const issuedAtStr = token.slice(0, dotIndex);
  const providedSig = token.slice(dotIndex + 1);
  const issuedAt = Number(issuedAtStr);
  if (!Number.isFinite(issuedAt) || issuedAt <= 0) return { valid: false };
  if (now - issuedAt > SESSION_TTL_MS) return { valid: false };
  if (issuedAt > now + 60_000) return { valid: false }; // future-dated token, reject

  const expectedSig = sign(issuedAtStr, getSecret());
  let expectedBuf, providedBuf;
  try {
    expectedBuf = Buffer.from(expectedSig, 'base64url');
    providedBuf = Buffer.from(providedSig, 'base64url');
  } catch {
    return { valid: false };
  }
  if (expectedBuf.length !== providedBuf.length) return { valid: false };
  if (!timingSafeEqual(expectedBuf, providedBuf)) return { valid: false };

  return { valid: true, issuedAt };
}

/**
 * Build a Set-Cookie header value for a freshly minted session token.
 */
export function buildSessionCookie(token) {
  const secure = process.env.NEXTAUTH_URL?.startsWith('https://') ? '; Secure' : '';
  const maxAgeSec = Math.floor(SESSION_TTL_MS / 1000);
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secure}`;
}

/**
 * Build a Set-Cookie header value that clears the session cookie.
 */
export function buildClearSessionCookie() {
  const secure = process.env.NEXTAUTH_URL?.startsWith('https://') ? '; Secure' : '';
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

/**
 * Read the session cookie out of a Next.js Request, if any.
 */
export function readSessionCookie(request) {
  const header = request.headers.get('cookie');
  if (!header) return null;
  const parts = header.split(';');
  for (const part of parts) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    if (name === SESSION_COOKIE_NAME) {
      return part.slice(eq + 1).trim();
    }
  }
  return null;
}

/**
 * Guard helper for admin-mutating route handlers.
 *
 *   const guard = requireAdmin(request);
 *   if (guard) return guard;
 *
 * Returns a NextResponse 401 when the admin session cookie is missing or invalid.
 * Returns null when a valid session is present.
 */
export function requireAdmin(request) {
  const token = readSessionCookie(request);
  const result = verifySessionToken(token || '');
  if (result.valid) return null;

  // Lazy import to avoid pulling NextResponse into the module's top scope
  // (keeps this file usable in non-route contexts and tests).
  const { NextResponse } = require('next/server');
  return NextResponse.json({ error: 'Admin authentication required' }, { status: 401 });
}
