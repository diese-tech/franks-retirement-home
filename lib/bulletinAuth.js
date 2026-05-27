import { NextResponse } from 'next/server';
import { getDiscordSessionUser, hasDiscordAdminRole } from '@/lib/discordAuth';

/**
 * Check if the current request is from an admin.
 * Returns the Discord session if admin, null otherwise.
 */
export function getBulletinAdmin(request) {
  const session = getDiscordSessionUser(request);
  if (!session || !hasDiscordAdminRole(session.roles)) return null;
  return session;
}

/**
 * Guard for bulletin board admin routes.
 * Returns null if authorized, NextResponse 401/403 if not.
 */
export function requireBulletinAdmin(request) {
  const session = getDiscordSessionUser(request);
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  if (!hasDiscordAdminRole(session.roles)) {
    return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
  }
  return null;
}
