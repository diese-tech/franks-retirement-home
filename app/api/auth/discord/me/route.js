import { NextResponse } from 'next/server';
import {
  getDiscordSessionUser,
  hasDiscordAdminRole,
  hasDiscordCaptainRole,
  hasDiscordPlayerRole,
  resolveTeamFromRoles,
  resolveDivisionFromRoles,
} from '@/lib/discordAuth';
import { readSessionCookie, verifySessionToken } from '@/lib/adminSession';
import { reportServerError } from '@/lib/apiError';

export const dynamic = 'force-dynamic';

// GET /api/auth/discord/me
// Returns the current session's identity info. Recognizes both auth
// mechanisms resolveAdminAuth() already accepts for admin mutations -- a
// Discord admin role, or the legacy password-gate session cookie -- so an
// admin who logged in via PasswordGate (not Discord) still gets isAdmin:
// true here instead of a 401 or a false isAdmin. Every client page that
// derives admin-only UI (e.g. the bulletin-board/fraud-watch/knows-ball
// inline "Edit" toggle) reads this endpoint, so this was previously
// hiding admin controls from password-authenticated admins entirely.
function hasValidPasswordSession(request) {
  const token = readSessionCookie(request);
  return verifySessionToken(token || '').valid;
}

export async function GET(request) {
  try {
    const session = getDiscordSessionUser(request);
    const passwordAdmin = hasValidPasswordSession(request);

    if (!session) {
      if (!passwordAdmin) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
      }
      return NextResponse.json({
        discordId: null,
        username: null,
        isAdmin: true,
        isCaptain: false,
        isPlayer: false,
        teamId: null,
        divisionId: null,
      });
    }

    return NextResponse.json({
      discordId: session.discordId,
      username: session.username,
      isAdmin: hasDiscordAdminRole(session.roles) || passwordAdmin,
      isCaptain: hasDiscordCaptainRole(session.roles),
      isPlayer: hasDiscordPlayerRole(session.roles),
      teamId: resolveTeamFromRoles(session.roles),
      divisionId: resolveDivisionFromRoles(session.roles),
    });
  } catch (err) {
    reportServerError(err, { route: 'auth/discord/me GET' });
    return NextResponse.json({ error: 'Failed to resolve session' }, { status: 500 });
  }
}
