import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getDiscordSessionUser, resolveTeamFromRoles } from '@/lib/discordAuth';
import { logAudit } from '@/lib/auditLog';
import { notifyChangeRequest } from '@/lib/discordWebhook';

export const dynamic = 'force-dynamic';

// GET — list change requests for the captain's team
export async function GET(req) {
  const session = getDiscordSessionUser(req);
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const teamId = resolveTeamFromRoles(session.roles);
  if (!teamId) return NextResponse.json({ error: 'No team found for your account' }, { status: 403 });

  try {
    const requests = await prisma.changeRequest.findMany({
      where: { teamId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return NextResponse.json(requests);
  } catch (err) {
    console.error('[captain/change-requests GET]', err);
    return NextResponse.json({ error: 'Change requests unavailable. Run database migrations.' }, { status: 503 });
  }
}

// POST — captain submits a change request
export async function POST(req) {
  const session = getDiscordSessionUser(req);
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const teamId = resolveTeamFromRoles(session.roles);
  if (!teamId) return NextResponse.json({ error: 'No team found for your account' }, { status: 403 });

  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { type, playerId, playerName, role, reason } = body;
  if (!type || !['ROSTER_ADD', 'ROSTER_REMOVE'].includes(type)) {
    return NextResponse.json({ error: 'type must be ROSTER_ADD or ROSTER_REMOVE' }, { status: 400 });
  }
  if (!playerId || !playerName) {
    return NextResponse.json({ error: 'playerId and playerName are required' }, { status: 400 });
  }

  let request;
  let team;
  try {
    // Check for duplicate pending request
    const existing = await prisma.changeRequest.findFirst({
      where: { teamId, status: 'pending', payload: { path: ['playerId'], equals: playerId } },
    });
    if (existing) {
      return NextResponse.json({ error: 'A pending request already exists for this player' }, { status: 409 });
    }

    team = await prisma.team.findUnique({ where: { id: teamId }, select: { name: true, tag: true } });

    request = await prisma.changeRequest.create({
      data: {
        type,
        teamId,
        requestedById: session.discordId,
        requestedByName: session.username,
        payload: { playerId, playerName, role: role ?? null, reason: reason ?? null },
      },
    });
  } catch (err) {
    console.error('[captain/change-requests POST]', err);
    return NextResponse.json({ error: 'Change requests unavailable. Run database migrations.' }, { status: 503 });
  }

  logAudit({
    entity: 'ChangeRequest',
    entityId: request.id,
    action: 'change_request_submitted',
    adminId: session.discordId,
    payload: { type, teamId, playerName },
  });

  notifyChangeRequest({ request, team, requesterName: session.username }).catch(() => {});

  return NextResponse.json(request, { status: 201 });
}
