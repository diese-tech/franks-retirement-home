import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAdmin } from '@/lib/adminSession';
import { computeStandings } from '@/lib/standings';

export const dynamic = 'force-dynamic';

function csvRow(values) {
  return values.map((v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',');
}

function csvFile(headers, rows) {
  return [csvRow(headers), ...rows.map(csvRow)].join('\r\n');
}

function csvResponse(filename, content) {
  return new Response(content, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

const TODAY = () => new Date().toISOString().slice(0, 10);

// GET /api/exports?type=standings|schedule|roster|stats&divisionId=...&seasonId=...
export async function GET(req) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');
  const divisionId = searchParams.get('divisionId');
  const seasonId = searchParams.get('seasonId');

  try {
    if (type === 'standings') {
      if (!divisionId) return NextResponse.json({ error: 'divisionId required' }, { status: 400 });
      const rows = await computeStandings(divisionId);
      const division = await prisma.division.findUnique({ where: { id: divisionId }, select: { name: true } });
      const content = csvFile(
        ['Rank', 'Team', 'Tag', 'W', 'L', 'GP', 'GW', 'GL', 'GDiff'],
        rows.map((r, i) => [i + 1, r.teamName, r.teamTag, r.wins, r.losses, r.played, r.gameWins, r.gameLosses, r.gameDiff])
      );
      return csvResponse(`frh-standings-${division?.name ?? divisionId}-${TODAY()}.csv`, content);
    }

    if (type === 'schedule') {
      const where = seasonId ? { seasonId } : {};
      const matches = await prisma.match.findMany({
        where,
        orderBy: [{ week: 'asc' }, { scheduledAt: 'asc' }],
        include: {
          season: { select: { name: true } },
          division: { select: { name: true } },
          homeTeam: { select: { name: true, tag: true } },
          awayTeam: { select: { name: true, tag: true } },
          games: { select: { gameNumber: true, winnerTeamId: true } },
        },
      });
      const content = csvFile(
        ['Season', 'Division', 'Week', 'ScheduledAt', 'HomeTeam', 'AwayTeam', 'Format', 'Status', 'StreamURL'],
        matches.map((m) => [
          m.season?.name, m.division?.name, m.week,
          m.scheduledAt ? new Date(m.scheduledAt).toISOString() : '',
          m.homeTeam?.name, m.awayTeam?.name,
          m.format, m.status, m.streamUrl ?? '',
        ])
      );
      return csvResponse(`frh-schedule-${TODAY()}.csv`, content);
    }

    if (type === 'roster') {
      const where = divisionId ? { divisionId } : {};
      const teams = await prisma.team.findMany({
        where,
        orderBy: { name: 'asc' },
        include: {
          division: { select: { name: true } },
          members: {
            where: { leftAt: null },
            include: { player: { select: { name: true, role: true, discordUsername: true, division: true } } },
          },
        },
      });
      const rows = [];
      for (const team of teams) {
        for (const m of team.members) {
          rows.push([team.name, team.tag, team.division?.name ?? '', m.player.name, m.player.discordUsername ?? '', m.player.role, m.isCaptain ? 'Captain' : m.isSub ? 'Sub' : 'Starter']);
        }
      }
      const content = csvFile(['Team', 'Tag', 'Division', 'Player', 'Discord', 'Role', 'Status'], rows);
      return csvResponse(`frh-roster-${TODAY()}.csv`, content);
    }

    if (type === 'stats') {
      const where = {};
      if (seasonId) {
        // Filter via match → season chain
        where.game = { match: { seasonId } };
      }
      const stats = await prisma.statLine.findMany({
        where,
        orderBy: [{ game: { match: { week: 'asc' } } }, { game: { gameNumber: 'asc' } }],
        include: {
          game: {
            select: {
              gameNumber: true,
              match: { select: { week: true, homeTeam: { select: { tag: true } }, awayTeam: { select: { tag: true } } } },
            },
          },
          player: { select: { name: true, discordUsername: true } },
          team: { select: { tag: true } },
          god: { select: { name: true } },
        },
      });
      const content = csvFile(
        ['Week', 'Match', 'Game', 'Team', 'Player', 'Discord', 'God', 'Role', 'K', 'D', 'A', 'Damage', 'Healing', 'Gold'],
        stats.map((s) => [
          s.game?.match?.week ?? '',
          `${s.game?.match?.homeTeam?.tag ?? '?'} vs ${s.game?.match?.awayTeam?.tag ?? '?'}`,
          s.game?.gameNumber ?? '',
          s.team?.tag ?? '', s.player?.name ?? '', s.player?.discordUsername ?? '',
          s.god?.name ?? '', s.role ?? '',
          s.kills, s.deaths, s.assists, s.damage, s.healing, s.gold,
        ])
      );
      return csvResponse(`frh-stats-approved-${TODAY()}.csv`, content);
    }

    return NextResponse.json({ error: 'type must be standings, schedule, roster, or stats' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
