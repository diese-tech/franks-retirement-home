import { NextResponse } from 'next/server';
import {
  buildClearSessionCookie,
  buildSessionCookie,
  createSessionToken,
  isAdminAuthRequired,
  readSessionCookie,
  verifySessionToken,
} from '@/lib/adminSession';

export const dynamic = 'force-dynamic';

// GET /api/admin-auth
// Lightweight probe used by AdminClient to detect a stale session before
// rendering the dashboard. Returns:
//   { ok: true, required: boolean } when the session is valid (or auth is off)
//   401 { error } when ADMIN_AUTH_REQUIRED=true and the cookie is missing/expired
export async function GET(request) {
  if (!isAdminAuthRequired()) {
    return NextResponse.json({ ok: true, required: false });
  }
  const token = readSessionCookie(request);
  const result = verifySessionToken(token || '');
  if (!result.valid) {
    return NextResponse.json({ error: 'Admin authentication required' }, { status: 401 });
  }
  return NextResponse.json({ ok: true, required: true });
}

// POST /api/admin-auth
// Body: { password }
// Verifies the shared admin password and, on success, mints an HMAC-signed
// HttpOnly session cookie. Same-origin AdminClient fetches send the cookie
// automatically — no client changes required.
export async function POST(request) {
  const { password } = await request.json().catch(() => ({}));
  if (!password) return NextResponse.json({ error: 'Password required' }, { status: 400 });

  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return NextResponse.json({ error: 'Server is missing ADMIN_PASSWORD' }, { status: 500 });
  }
  if (password !== expected) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
  }

  const token = createSessionToken();
  const response = NextResponse.json({ ok: true });
  response.headers.set('Set-Cookie', buildSessionCookie(token));
  return response;
}

// DELETE /api/admin-auth — log out by clearing the session cookie.
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.headers.set('Set-Cookie', buildClearSessionCookie());
  return response;
}
