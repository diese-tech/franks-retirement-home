import { NextResponse } from 'next/server';
import { validateDiscordEnv, getDiscordAuthUrl } from '@/lib/discordAuth';

export const dynamic = 'force-dynamic';

// GET /api/auth/discord
// Redirects to Discord OAuth2 authorize URL.
// If Discord env vars are not configured, returns 503.
// NOTE: state param is used for return-URL only, not CSRF mitigation.
// A nonce-in-state-with-cookie approach should be added in a future iteration.
export async function GET(request) {
  const env = validateDiscordEnv();
  if (!env.valid) {
    return NextResponse.json(
      { error: 'Discord OAuth not configured', missing: env.missing },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);
  const rawReturnUrl = searchParams.get('returnUrl');

  // Validate returnUrl: must resolve to same origin to prevent open redirect
  let safeReturnUrl;
  if (rawReturnUrl) {
    try {
      const baseUrl = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000');
      const candidate = new URL(rawReturnUrl, baseUrl);
      safeReturnUrl = candidate.origin === new URL(baseUrl).origin
        ? candidate.pathname + candidate.search
        : undefined;
    } catch {
      safeReturnUrl = undefined;
    }
  }

  const authorizeUrl = getDiscordAuthUrl(safeReturnUrl);
  return NextResponse.redirect(authorizeUrl, 302);
}
