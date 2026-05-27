import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAdmin } from '@/lib/adminSession';
import { HOMEPAGE_DEFAULTS } from '@/lib/homepageDefaults';

export const dynamic = 'force-dynamic';

// ── Validation ────────────────────────────────────────────────────────────────

const MAX_LENGTHS = {
  discordInviteUrl: 200,
};
const ARRAY_LIMITS = {
  ticker: 20, headlines: 10, bulletin: 20,
  fraudWatch: 10, rivalries: 8, knowsBall: 10,
  washedReports: 15, socialCards: 12,
};
const SECTION_FIELDS = [
  'ticker','headlines','bulletin','fraudWatch','motw',
  'rivalries','knowsBall','washedReports','socialCards',
];
const VISIBILITY_FIELDS = [
  'showTicker','showHeadlines','showBulletin','showFraudWatch',
  'showMotw','showRivalries','showKnowsBall','showWashedReports','showSocialCards',
];

function validatePayload(body) {
  const errors = [];

  for (const field of SECTION_FIELDS) {
    if (!(field in body)) continue;
    if (field === 'motw') {
      if (typeof body.motw !== 'object' || Array.isArray(body.motw)) {
        errors.push('motw must be an object');
      }
    } else {
      if (!Array.isArray(body[field])) {
        errors.push(`${field} must be an array`);
      } else if (ARRAY_LIMITS[field] && body[field].length > ARRAY_LIMITS[field]) {
        errors.push(`${field} exceeds max ${ARRAY_LIMITS[field]} items`);
      }
    }
  }

  if ('discordInviteUrl' in body) {
    const u = body.discordInviteUrl;
    if (typeof u !== 'string') {
      errors.push('discordInviteUrl must be a string');
    } else if (u.length > MAX_LENGTHS.discordInviteUrl) {
      errors.push(`discordInviteUrl too long (max ${MAX_LENGTHS.discordInviteUrl})`);
    } else if (u && !u.startsWith('https://')) {
      errors.push('discordInviteUrl must start with https://');
    }
  }

  if ('washedPct' in body) {
    const v = body.washedPct;
    if (typeof v !== 'number' || v < 0 || v > 100) {
      errors.push('washedPct must be a number 0–100');
    }
  }

  for (const field of VISIBILITY_FIELDS) {
    if (field in body && typeof body[field] !== 'boolean') {
      errors.push(`${field} must be a boolean`);
    }
  }

  return errors;
}

function pickContentFields(body) {
  const data = {};
  for (const f of SECTION_FIELDS)        if (f in body) data[f]   = body[f];
  for (const f of VISIBILITY_FIELDS)     if (f in body) data[f]   = body[f];
  if ('discordInviteUrl' in body)         data.discordInviteUrl    = body.discordInviteUrl;
  if ('washedPct'        in body)         data.washedPct           = body.washedPct;
  return data;
}

// ── GET /api/admin/homepage-content ──────────────────────────────────────────
// Returns both draft and published rows (either may be null).
export async function GET(request) {
  const guard = requireAdmin(request);
  if (guard) return guard;

  try {
    const [draft, published] = await Promise.all([
      prisma.homepageContent.findUnique({ where: { status: 'draft' } }),
      prisma.homepageContent.findUnique({ where: { status: 'published' } }),
    ]);
    return NextResponse.json({ draft, published });
  } catch (err) {
    console.error('[homepage-content GET]', err);
    return NextResponse.json({ error: 'Failed to load homepage content' }, { status: 500 });
  }
}

// ── POST /api/admin/homepage-content ─────────────────────────────────────────
// Body: { action: 'save' | 'publish', ...contentFields }
//
// save    → upsert the draft row, do not touch published
// publish → copy draft (or supplied body) to published row atomically
export async function POST(request) {
  const guard = requireAdmin(request);
  if (guard) return guard;

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { action = 'save', savedByAdminId = null, ...rest } = body;
  if (!['save', 'publish'].includes(action)) {
    return NextResponse.json({ error: 'action must be "save" or "publish"' }, { status: 400 });
  }

  const errors = validatePayload(rest);
  if (errors.length) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 422 });
  }

  const contentData = pickContentFields(rest);

  try {
    if (action === 'save') {
      const row = await prisma.homepageContent.upsert({
        where:  { status: 'draft' },
        update: { ...contentData, savedAt: new Date(), savedByAdminId },
        create: { status: 'draft', ...HOMEPAGE_DEFAULTS, ...contentData, savedAt: new Date(), savedByAdminId },
      });
      return NextResponse.json({ ok: true, draft: row });
    }

    // publish: load draft (or use body) → write to published
    const draftRow = await prisma.homepageContent.findUnique({ where: { status: 'draft' } });
    const baseContent = draftRow ? pickContentFields(draftRow) : {};
    // Body fields override draft (allows publish-without-prior-save)
    const publishData = { ...HOMEPAGE_DEFAULTS, ...baseContent, ...contentData };

    const published = await prisma.homepageContent.upsert({
      where:  { status: 'published' },
      update: { ...publishData, publishedAt: new Date(), savedAt: new Date(), savedByAdminId },
      create: { status: 'published', ...publishData, publishedAt: new Date(), savedAt: new Date(), savedByAdminId },
    });
    return NextResponse.json({ ok: true, published });
  } catch (err) {
    console.error('[homepage-content POST]', err);
    return NextResponse.json({ error: 'Failed to save homepage content' }, { status: 500 });
  }
}

// ── DELETE /api/admin/homepage-content ───────────────────────────────────────
// ?target=draft     → delete draft row (Reset to Default)
// ?target=published → delete published row (revert public page to defaults)
// ?target=all       → delete both
export async function DELETE(request) {
  const guard = requireAdmin(request);
  if (guard) return guard;

  const { searchParams } = new URL(request.url);
  const target = searchParams.get('target') ?? 'draft';

  if (!['draft', 'published', 'all'].includes(target)) {
    return NextResponse.json({ error: 'target must be draft, published, or all' }, { status: 400 });
  }

  try {
    const statuses = target === 'all' ? ['draft', 'published'] : [target];
    await prisma.homepageContent.deleteMany({ where: { status: { in: statuses } } });
    return NextResponse.json({ ok: true, deleted: statuses });
  } catch (err) {
    console.error('[homepage-content DELETE]', err);
    return NextResponse.json({ error: 'Failed to delete homepage content' }, { status: 500 });
  }
}
