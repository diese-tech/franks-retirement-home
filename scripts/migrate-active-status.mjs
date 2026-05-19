// One-shot migration: map any existing Draft rows with status='active' to
// either 'picking' (if at least one pick has a godId) or 'pending'
// (otherwise). The 'active' status is being retired in this commit; see
// issue #11 for the full rationale.
//
// Usage:
//   node scripts/migrate-active-status.mjs        # dry-run (default)
//   node scripts/migrate-active-status.mjs --apply
//
// The dry-run prints the count and the per-row target status so you can
// audit before applying. --apply does the writes; it is idempotent (no-op
// once no 'active' rows remain).

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const apply = process.argv.includes('--apply');

async function main() {
  const rows = await prisma.draft.findMany({
    where: { status: 'active' },
    include: { picks: { select: { godId: true } } },
  });

  if (rows.length === 0) {
    console.log("No drafts with status='active'. Nothing to migrate.");
    return;
  }

  const plan = rows.map((row) => {
    const hasAssignedPick = row.picks.some((p) => p.godId !== null);
    return { id: row.id, name: row.name, target: hasAssignedPick ? 'picking' : 'pending' };
  });

  console.log(`Found ${plan.length} draft(s) with status='active':`);
  for (const item of plan) {
    console.log(`  ${item.id}  "${item.name}"  -> ${item.target}`);
  }

  if (!apply) {
    console.log('\nDry-run. Re-run with --apply to write the changes.');
    return;
  }

  for (const item of plan) {
    await prisma.draft.update({ where: { id: item.id }, data: { status: item.target } });
  }
  console.log(`\nUpdated ${plan.length} draft row(s).`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
