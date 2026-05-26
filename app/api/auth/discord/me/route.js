import { NextResponse } from 'next/server';
import {
  getDiscordSessionUser,
  hasDiscordAdminRole,
  resolveTeamFromRoles,
} from '@/lib/discordAuth';

export const dynamic = 'force-dynamic';

// GET /api/auth/discord/me
// Returns the current Discord session user info (or 401 if not logged in).
export async function GET(request) {
  const session = getDiscordSessionUser(request);
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  return NextResponse.json({
    discordId: session.discordId,
    username: session.username,
    isAdmin: hasDiscordAdminRole(session.roles),
    teamId: resolveTeamFromRoles(session.roles),
  });
}
