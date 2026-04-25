import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { PLAYER_ROLES } from '@/lib/constants';

// POST /api/players/import
// Body: { players: [{ name, role, discordUsername?, division? }] }
// Upserts by name (case-insensitive match on existing records).
// Returns { imported, skipped, errors }
export async function POST(request) {
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { players } = body;
  if (!Array.isArray(players) || players.length === 0) {
    return NextResponse.json({ error: 'players must be a non-empty array' }, { status: 400 });
  }
  if (players.length > 500) {
    return NextResponse.json({ error: 'Maximum 500 players per import' }, { status: 400 });
  }

  const results = { imported: 0, updated: 0, errors: [] };

  for (const row of players) {
    const name = typeof row.name === 'string' ? row.name.trim() : '';
    const role = typeof row.role === 'string' ? row.role.trim() : '';
    const discordUsername = typeof row.discordUsername === 'string' ? row.discordUsername.trim() || null : null;
    const division = typeof row.division === 'string' ? row.division.trim() || null : null;

    if (!name) { results.errors.push({ row, reason: 'Missing name' }); continue; }
    if (!PLAYER_ROLES.includes(role)) { results.errors.push({ row, reason: `Invalid role: ${role}` }); continue; }

    try {
      const existing = await prisma.player.findFirst({
        where: { name: { equals: name, mode: 'insensitive' } },
      });

      if (existing) {
        await prisma.player.update({
          where: { id: existing.id },
          data: { role, discordUsername, division },
        });
        results.updated++;
      } else {
        await prisma.player.create({
          data: { name, role, discordUsername, division },
        });
        results.imported++;
      }
    } catch {
      results.errors.push({ row, reason: 'Database error' });
    }
  }

  return NextResponse.json(results);
}
