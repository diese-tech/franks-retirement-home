import { resolveAdminAuth } from '@/lib/resolveAuth';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

function csvRow(values) {
  return values.map((v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',');
}

const TODAY = () => new Date().toISOString().slice(0, 10);

// GET /api/exports/pending-ocr — admin-only
// Exports ExtractedStatLine rows where status = 'pending'.
// Filename and STATUS column make it unambiguous this is NOT official data.
export async function GET(req) {
  const authError = await resolveAdminAuth(req);
  if (authError) return authError;

  const rows = await prisma.extractedStatLine.findMany({
    where: { status: 'pending' },
    include: {
      extraction: { select: { id: true, gameId: true, confidence: true, requestedAt: true } },
      player: { select: { name: true } },
      god: { select: { name: true } },
    },
    orderBy: { extraction: { requestedAt: 'asc' } },
  });

  const headers = [
    'STATUS', 'ExtractionId', 'GameId', 'Confidence', 'ExtractedAt',
    'IGN_Raw', 'Team_Raw', 'Role_Raw', 'God_Raw', 'ResolvedPlayer', 'ResolvedGod',
    'K', 'D', 'A', 'DmgDealt', 'DmgMitigated', 'Healing', 'Gold', 'StructureDmg',
  ];

  const lines = [
    csvRow(headers),
    ...rows.map((r) => csvRow([
      'PENDING — NOT OFFICIAL',
      r.extractionId,
      r.extraction?.gameId ?? '',
      r.extraction?.confidence ?? '',
      r.extraction?.requestedAt ? new Date(r.extraction.requestedAt).toISOString() : '',
      r.ignRaw, r.teamRaw ?? '', r.roleRaw ?? '', r.godRaw ?? '',
      r.player?.name ?? '(unresolved)', r.god?.name ?? '(unresolved)',
      r.kills, r.deaths, r.assists, r.damageDealt, r.damageMitigated, r.healing, r.goldEarned, r.structureDamage,
    ])),
  ];

  return new Response(lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="frh-s9-pending-ocr-${TODAY()}.csv"`,
    },
  });
}
