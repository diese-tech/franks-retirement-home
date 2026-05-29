import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { resolveAdminAuth } from '@/lib/resolveAuth';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// POST /api/stats/import — admin: bulk upsert StatLine rows from CSV data.
// Fallback path when ForgeLens is unavailable.
// Body: { gameId, rows: [{ playerDiscord?, playerName?, teamTag, kills, deaths,
//   assists, damage, healing, gold, godName? }] }
// Resolves player by discordUsername first, then case-insensitive name.
// Resolves god by case-insensitive name. Resolves team by tag within the game's match.
// Returns { imported, updated, errors: [{ row, reason }] }
export async function POST(req) {
  const authError = await resolveAdminAuth(req);
  if (authError) return authError;

  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { gameId, rows } = body;
  if (!gameId || !Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'gameId and non-empty rows array are required' }, { status: 400 });
  }

  // Fetch game + match context for team resolution
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      match: {
        include: {
          homeTeam: { select: { id: true, tag: true } },
          awayTeam: { select: { id: true, tag: true } },
        },
      },
    },
  });
  if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 });

  const results = { imported: 0, updated: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;

    try {
      // Resolve player
      let player = null;
      if (row.playerDiscord) {
        player = await prisma.player.findFirst({ where: { discordUsername: row.playerDiscord } });
      }
      if (!player && row.playerName) {
        player = await prisma.player.findFirst({ where: { name: { equals: row.playerName, mode: 'insensitive' } } });
      }
      // Also try PlayerAlias
      if (!player && (row.playerName || row.playerDiscord)) {
        const aliasKey = row.playerName || row.playerDiscord;
        const alias = await prisma.playerAlias.findUnique({ where: { alias: aliasKey } });
        if (alias) player = await prisma.player.findUnique({ where: { id: alias.playerId } });
      }
      if (!player) {
        results.errors.push({ row: rowNum, reason: `Player not found: discord="${row.playerDiscord ?? ''}" name="${row.playerName ?? ''}"` });
        continue;
      }

      // Resolve team
      let teamId = null;
      const homeTag = game.match.homeTeam.tag.toLowerCase();
      const awayTag = game.match.awayTeam.tag.toLowerCase();
      const rowTag = (row.teamTag ?? '').toLowerCase();
      if (rowTag === homeTag) teamId = game.match.homeTeam.id;
      else if (rowTag === awayTag) teamId = game.match.awayTeam.id;
      if (!teamId) {
        results.errors.push({ row: rowNum, reason: `Team tag "${row.teamTag}" doesn't match home (${game.match.homeTeam.tag}) or away (${game.match.awayTeam.tag})` });
        continue;
      }

      // Resolve god (optional)
      let godId = null;
      if (row.godName) {
        const god = await prisma.god.findFirst({ where: { name: { equals: row.godName, mode: 'insensitive' } } });
        if (god) godId = god.id;
      }

      const existing = await prisma.statLine.findUnique({
        where: { gameId_playerId: { gameId, playerId: player.id } },
      });

      await prisma.statLine.upsert({
        where: { gameId_playerId: { gameId, playerId: player.id } },
        create: {
          gameId,
          playerId: player.id,
          teamId,
          godId,
          kills: parseInt(row.kills, 10) || 0,
          deaths: parseInt(row.deaths, 10) || 0,
          assists: parseInt(row.assists, 10) || 0,
          damage: parseInt(row.damage, 10) || 0,
          healing: parseInt(row.healing, 10) || 0,
          gold: parseInt(row.gold, 10) || 0,
        },
        update: {
          teamId,
          godId,
          kills: parseInt(row.kills, 10) || 0,
          deaths: parseInt(row.deaths, 10) || 0,
          assists: parseInt(row.assists, 10) || 0,
          damage: parseInt(row.damage, 10) || 0,
          healing: parseInt(row.healing, 10) || 0,
          gold: parseInt(row.gold, 10) || 0,
        },
      });

      if (existing) results.updated++;
      else results.imported++;

    } catch {
      results.errors.push({ row: rowNum, reason: 'Unexpected error processing this row' });
    }
  }

  logAudit('StatLine', gameId, 'bulk_import', { payload: { imported: results.imported, updated: results.updated, errors: results.errors.length } });
  return NextResponse.json(results);
}
