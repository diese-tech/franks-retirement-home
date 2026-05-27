// Environment variable verification script.
// Validates format and presence of critical env vars WITHOUT connecting to the database.
//
// Usage:
//   node scripts/verify-env.mjs
//   npm run verify:env
//
// Exit 0 if all checks pass, exit 1 if any fail.

const results = [];

function check(name, pass, detail) {
  results.push({ name, pass, detail });
}

// ── Helpers ──────────────────────────────────────────────────

function extractProjectRef(url) {
  // Supabase URLs follow: postgresql://postgres.PROJECT-REF:PASSWORD@host:port/postgres
  const match = url.match(/postgres\.([^:@]+)/);
  return match ? match[1] : null;
}

function extractPort(url) {
  const match = url.match(/:(\d+)\/postgres/);
  return match ? parseInt(match[1], 10) : null;
}

// ── DATABASE_URL ─────────────────────────────────────────────

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  check('DATABASE_URL exists', false, 'Not set');
} else {
  check('DATABASE_URL exists', true, 'Set');

  const dbPort = extractPort(databaseUrl);
  if (dbPort === 6543) {
    check('DATABASE_URL uses port 6543 (pooled)', true, `Port: ${dbPort}`);
  } else {
    check('DATABASE_URL uses port 6543 (pooled)', false, `Port: ${dbPort ?? 'not detected'}. Expected 6543 for Supavisor pooled connection.`);
  }
}

// ── DIRECT_URL ───────────────────────────────────────────────

const directUrl = process.env.DIRECT_URL;

if (!directUrl) {
  check('DIRECT_URL exists', false, 'Not set');
} else {
  check('DIRECT_URL exists', true, 'Set');

  const directPort = extractPort(directUrl);
  if (directPort === 5432) {
    check('DIRECT_URL uses port 5432 (session/direct)', true, `Port: ${directPort}`);
  } else {
    check('DIRECT_URL uses port 5432 (session/direct)', false, `Port: ${directPort ?? 'not detected'}. Expected 5432 for direct session connection.`);
  }
}

// ── Project-ref consistency ──────────────────────────────────

if (databaseUrl && directUrl) {
  const dbRef = extractProjectRef(databaseUrl);
  const directRef = extractProjectRef(directUrl);

  if (!dbRef || !directRef) {
    check('DATABASE_URL and DIRECT_URL reference same project', false, `Could not extract project-ref. DATABASE_URL ref: ${dbRef ?? 'none'}, DIRECT_URL ref: ${directRef ?? 'none'}`);
  } else if (dbRef === directRef) {
    check('DATABASE_URL and DIRECT_URL reference same project', true, `Project-ref: ${dbRef}`);
  } else {
    check('DATABASE_URL and DIRECT_URL reference same project', false, `Mismatch! DATABASE_URL ref: ${dbRef}, DIRECT_URL ref: ${directRef}`);
  }
}

// ── ADMIN_SESSION_SECRET ─────────────────────────────────────

const adminSecret = process.env.ADMIN_SESSION_SECRET;

if (!adminSecret) {
  check('ADMIN_SESSION_SECRET exists', false, 'Not set');
} else {
  check('ADMIN_SESSION_SECRET exists', true, 'Set');

  if (adminSecret.length >= 16) {
    check('ADMIN_SESSION_SECRET >= 16 characters', true, `Length: ${adminSecret.length}`);
  } else {
    check('ADMIN_SESSION_SECRET >= 16 characters', false, `Length: ${adminSecret.length}. Minimum 16 required.`);
  }
}

// ── Other critical variables ─────────────────────────────────

const criticalVars = [
  'ADMIN_PASSWORD',
  'NEXTAUTH_URL',
];

for (const varName of criticalVars) {
  const value = process.env[varName];
  if (value) {
    check(`${varName} exists`, true, 'Set');
  } else {
    check(`${varName} exists`, false, 'Not set');
  }
}

// ── Report ───────────────────────────────────────────────────

console.log('\n  Environment Variable Verification\n');
console.log('  ' + '─'.repeat(50));

let failures = 0;
for (const r of results) {
  const icon = r.pass ? 'PASS' : 'FAIL';
  const prefix = r.pass ? '  ✓' : '  ✗';
  console.log(`${prefix} [${icon}] ${r.name}`);
  if (!r.pass) {
    console.log(`         → ${r.detail}`);
    failures++;
  }
}

console.log('\n  ' + '─'.repeat(50));
console.log(`  ${results.length} checks, ${failures} failed.\n`);

if (failures > 0) {
  process.exit(1);
}
