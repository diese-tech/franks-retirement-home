import { NextResponse } from 'next/server';
import { validateDiscordEnv, getDiscordAuthUrl } from '@/lib/discordAuth';

export const dynamic = 'force-dynamic';

// GET /api/auth/discord
// Redirects to Discord OAuth2 authorize URL.
// If Discord env vars are not configured, returns 503.
export async function GET(request) {
  const env = validateDiscordEnv();
  if (!env.valid) {
    return NextResponse.json(
      { error: 'Discord OAuth not configured', missing: env.missing },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);
  const returnUrl = searchParams.get('returnUrl') || undefined;

  const authorizeUrl = getDiscordAuthUrl(returnUrl);
  return NextResponse.redirect(authorizeUrl, 302);
}
