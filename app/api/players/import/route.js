import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { PLAYER_ROLES } from '@/lib/constants';
import { resolveAdminAuth } from '@/lib/resolveAuth';
import { invalidatePlayers } from '@/lib/referenceData';

// POST /api/players/import
// Body: { players: [{ name, role, discordUsername?, division? }] }
// Upserts by discordUsername when present, falls back to name (case-insensitive).
// Returns { imported, updated, skipped, errors }
export async function POST(request) {
  const guard = await resolveAdminAuth(request);
  if (guard) return guard;

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

  const results = { imported: 0, updated: 0, skipped: 0, errors: [] };

  for (const row of players) {
    const name = typeof row.name === 'string' ? row.name.trim() : '';
    const role = typeof row.role === 'string' ? row.role.trim() : '';
    const discordUsername = typeof row.discordUsername === 'string' ? row.discordUsername.trim() || null : null;
    const division = typeof row.division === 'string' ? row.division.trim() || null : null;
    const timezone = typeof row.timezone === 'string' ? row.timezone.trim() || null : null;
    const secondaryRoles = Array.isArray(row.secondaryRoles)
      ? row.secondaryRoles.filter(r => PLAYER_ROLES.includes(r))
      : [];

    if (!name) { results.errors.push({ row, reason: 'Missing name' }); continue; }
    if (name.length > 100) { results.errors.push({ row, reason: 'name exceeds 100 chars' }); continue; }
    if (!PLAYER_ROLES.includes(role)) { results.errors.push({ row, reason: `Invalid role: ${role}` }); continue; }
    if (discordUsername && discordUsername.length > 64) { results.errors.push({ row, reason: 'discordUsername exceeds 64 chars' }); continue; }
    if (division && division.length > 64) { results.errors.push({ row, reason: 'division exceeds 64 chars' }); continue; }

    try {
      // Prefer discordUsername as stable dedup key; fall back to case-insensitive name match
      const existing = discordUsername
        ? await prisma.player.findFirst({ where: { discordUsername } })
        : await prisma.player.findFirst({ where: { name: { equals: name, mode: 'insensitive' } } });

      if (existing) {
        const unchanged =
          existing.name === name &&
          existing.role === role &&
          existing.discordUsername === discordUsername &&
          existing.division === division &&
          (existing.secondaryRoles ?? []).join(',') === secondaryRoles.join(',') &&
          existing.timezone === timezone;

        if (unchanged) {
          results.skipped++;
        } else {
          await prisma.player.update({
            where: { id: existing.id },
            data: { name, role, discordUsername, division, timezone, secondaryRoles },
          });
          results.updated++;
        }
      } else {
        await prisma.player.create({
          data: { name, role, discordUsername, division, timezone, secondaryRoles },
        });
        results.imported++;
      }
    } catch {
      results.errors.push({ row, reason: 'Database error' });
    }
  }

  if (results.imported > 0 || results.updated > 0) invalidatePlayers();

  return NextResponse.json(results);
}
