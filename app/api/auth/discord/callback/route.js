import { NextResponse } from 'next/server';
import {
  validateDiscordEnv,
  exchangeCode,
  getDiscordUser,
  getDiscordGuildMember,
  buildDiscordSessionCookie,
  buildSetCookieHeader,
} from '@/lib/discordAuth';

export const dynamic = 'force-dynamic';

// GET /api/auth/discord/callback
// Handles the OAuth2 redirect from Discord.
// Exchanges code for token, fetches user info, sets session cookie.
export async function GET(request) {
  const env = validateDiscordEnv();
  if (!env.valid) {
    return NextResponse.json(
      { error: 'Discord OAuth not configured', missing: env.missing },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // returnUrl

  if (!code) {
    return NextResponse.json({ error: 'Missing authorization code' }, { status: 400 });
  }

  // Build redirect URI (must match what was sent in the authorize request)
  const baseUrl = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000');
  const redirectUri = `${process.env.NEXTAUTH_URL || baseUrl}/api/auth/discord/callback`;

  let tokens;
  try {
    tokens = await exchangeCode(code, redirectUri);
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to exchange authorization code', detail: err.message },
      { status: 502 },
    );
  }

  let user;
  try {
    user = await getDiscordUser(tokens.access_token);
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to fetch Discord user profile', detail: err.message },
      { status: 502 },
    );
  }

  const guildId = process.env.DISCORD_GUILD_ID;
  let member;
  try {
    member = await getDiscordGuildMember(tokens.access_token, guildId);
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to fetch guild membership', detail: err.message },
      { status: 502 },
    );
  }

  if (!member) {
    return NextResponse.json(
      { error: 'You must be a member of the FRH Discord server' },
      { status: 403 },
    );
  }

  // Build session cookie
  const cookieValue = buildDiscordSessionCookie({
    discordId: user.id,
    username: user.username,
    roles: member.roles || [],
  });

  const returnUrl = state || '/';
  const response = NextResponse.redirect(new URL(returnUrl, baseUrl), 302);
  response.headers.set('Set-Cookie', buildSetCookieHeader(cookieValue));
  return response;
}
