import { NextResponse } from 'next/server';
import { clearDiscordSessionCookie } from '@/lib/discordAuth';

export const dynamic = 'force-dynamic';

// POST /api/auth/discord/logout
// Clears the Discord session cookie.
export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.headers.set('Set-Cookie', clearDiscordSessionCookie());
  return response;
}
