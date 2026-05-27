// Read-only database connectivity verification script.
// Connects via Prisma, counts rows in critical tables, and reports results.
//
// Usage:
//   node scripts/verify-db.mjs
//
// Requires DATABASE_URL and DIRECT_URL to be set (e.g. via .env.local).
// Exit 0 if all tables are accessible, exit 1 on connection error.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const tables = [
  { name: 'Season', query: () => prisma.season.count() },
  { name: 'Player', query: () => prisma.player.count() },
  { name: 'Team', query: () => prisma.team.count() },
  { name: 'Division', query: () => prisma.division.count() },
  { name: 'God', query: () => prisma.god.count() },
  { name: 'HomepageContent', query: () => prisma.homepageContent.count() },
];

async function main() {
  console.log('\n  Database Connectivity Verification\n');
  console.log('  ' + '─'.repeat(40));
  console.log('  ' + 'Table'.padEnd(20) + '| Count');
  console.log('  ' + '─'.repeat(40));

  let allPassed = true;

  for (const table of tables) {
    try {
      const count = await table.query();
      console.log('  ' + table.name.padEnd(20) + `| ${count}`);
    } catch (err) {
      console.log('  ' + table.name.padEnd(20) + `| ERROR: ${err.message}`);
      allPassed = false;
    }
  }

  console.log('  ' + '─'.repeat(40));

  if (allPassed) {
    console.log('\n  PASS - All tables accessible.\n');
  } else {
    console.log('\n  FAIL - One or more tables returned errors.\n');
    console.log('  Possible causes:');
    console.log('    - Migrations have not been deployed (run: npx prisma migrate deploy)');
    console.log('    - DATABASE_URL points to wrong Supabase project');
    console.log('    - Database is unreachable from current network\n');
    process.exit(1);
  }
}

main()
  .catch((err) => {
    console.error('\n  FAIL - Could not connect to database.\n');
    console.error(`  Error: ${err.message}\n`);
    console.error('  Verify that DATABASE_URL and DIRECT_URL are correctly set.');
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
