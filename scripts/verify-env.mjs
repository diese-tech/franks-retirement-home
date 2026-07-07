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

// Warn-level check: reported but does not fail the run. Use for optional
// features that degrade gracefully when unconfigured.
function warn(name, ok, detail) {
  results.push({ name, pass: ok, detail, warnOnly: true });
}

// Placeholder values copied straight from .env.example.
function isPlaceholder(value) {
  return /^(change-me|YOUR_)/i.test(value ?? '');
}

// ── Helpers ──────────────────────────────────────────────────

function extractProjectRef(url) {
  // Supabase URLs follow: postgresql://postgres.PROJECT-REF:PASSWORD@host:port/postgres
  const match = url.match(/postgres\.([^:@]+)/);
  return match ? match[1] : null;
}

function extractPort(url) {
  const match = url.match(/:(\d+)\//);
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

// ── Discord OAuth (required for captain/admin login) ─────────

const discordVars = [
  'DISCORD_CLIENT_ID',
  'DISCORD_CLIENT_SECRET',
  'DISCORD_GUILD_ID',
  'DISCORD_ADMIN_ROLE_ID',
  'DISCORD_HOSPICE_CAPTAIN_ROLE_ID',
  'DISCORD_REHABILITATION_CAPTAIN_ROLE_ID',
  'DISCORD_HOSPICE_PLAYER_ROLE_IDS',
  'DISCORD_REHABILITATION_PLAYER_ROLE_IDS',
];

for (const varName of discordVars) {
  const value = process.env[varName];
  if (!value) {
    check(`${varName} exists`, false, 'Not set — Discord captain/admin login will not work');
  } else if (isPlaceholder(value)) {
    check(`${varName} exists`, false, `Still set to the .env.example placeholder (${value.slice(0, 20)}…)`);
  } else {
    check(`${varName} exists`, true, 'Set');
  }
}

const discordSessionSecret = process.env.DISCORD_SESSION_SECRET;
if (!discordSessionSecret) {
  check('DISCORD_SESSION_SECRET exists', false, 'Not set');
} else if (isPlaceholder(discordSessionSecret)) {
  check('DISCORD_SESSION_SECRET exists', false, 'Still set to the .env.example placeholder');
} else if (discordSessionSecret.length < 16) {
  check('DISCORD_SESSION_SECRET >= 16 characters', false, `Length: ${discordSessionSecret.length}. Minimum 16 required.`);
} else {
  check('DISCORD_SESSION_SECRET >= 16 characters', true, `Length: ${discordSessionSecret.length}`);
}

const teamRoleMapRaw = process.env.DISCORD_TEAM_ROLE_MAP_JSON;
if (!teamRoleMapRaw) {
  check('DISCORD_TEAM_ROLE_MAP_JSON exists', false, 'Not set — Discord captain team resolution will not work');
} else {
  let map = null;
  try { map = JSON.parse(teamRoleMapRaw); } catch { /* handled below */ }
  if (!map || typeof map !== 'object' || Array.isArray(map)) {
    check('DISCORD_TEAM_ROLE_MAP_JSON is a JSON object', false, 'Does not parse as a JSON object');
  } else {
    const entries = Object.entries(map);
    const placeholders = entries.filter(([, v]) => isPlaceholder(v)).map(([k]) => k);
    if (entries.length === 0) {
      check('DISCORD_TEAM_ROLE_MAP_JSON is a JSON object', false, 'Parses but contains no team entries');
    } else if (placeholders.length > 0) {
      check('DISCORD_TEAM_ROLE_MAP_JSON has real role IDs', false, `Placeholder role IDs for: ${placeholders.join(', ')}`);
    } else {
      check('DISCORD_TEAM_ROLE_MAP_JSON is a JSON object', true, `${entries.length} team(s) mapped`);
    }
  }
}

// ── Optional integrations (warn only) ────────────────────────

warn('GEMINI_API_KEY set (OCR extraction)', !!process.env.GEMINI_API_KEY && !isPlaceholder(process.env.GEMINI_API_KEY),
  'Not set — captain screenshot OCR extraction is disabled');
warn('SENTRY_DSN set (error monitoring)', !!process.env.SENTRY_DSN,
  'Not set — production errors will not be reported to Sentry');

const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
if (!!upstashUrl !== !!upstashToken) {
  check('UPSTASH_REDIS_REST_URL and _TOKEN set together', false, 'Only one of the pair is set');
} else {
  warn('Upstash Redis set (distributed rate limiting)', !!upstashUrl,
    'Not set — rate limiting falls back to per-process in-memory (weak on multi-instance serverless)');
}

// ForgeLens: if the worker URL is configured, the API key and the callback
// HMAC secret are required — the callback rejects everything without the
// secret (fail-closed).
const forgeLensUrl = process.env.FORGELENS_URL;
if (forgeLensUrl) {
  check('FORGELENS_API_KEY exists (FORGELENS_URL is set)', !!process.env.FORGELENS_API_KEY, 'Not set — job dispatch will be unauthenticated');
  check('FORGELENS_HMAC_SECRET exists (FORGELENS_URL is set)', !!process.env.FORGELENS_HMAC_SECRET, 'Not set — the callback rejects all worker results (503)');
} else {
  warn('FORGELENS_URL set (external OCR worker)', false, 'Not set — OCR jobs are not dispatched to a worker');
}

// ── Report ───────────────────────────────────────────────────

console.log('\n  Environment Variable Verification\n');
console.log('  ' + '─'.repeat(50));

let failures = 0;
let warnings = 0;
for (const r of results) {
  if (r.pass) {
    console.log(`  ✓ [PASS] ${r.name}`);
  } else if (r.warnOnly) {
    console.log(`  ! [WARN] ${r.name}`);
    console.log(`         → ${r.detail}`);
    warnings++;
  } else {
    console.log(`  ✗ [FAIL] ${r.name}`);
    console.log(`         → ${r.detail}`);
    failures++;
  }
}

console.log('\n  ' + '─'.repeat(50));
console.log(`  ${results.length} checks, ${failures} failed, ${warnings} warnings.\n`);

if (failures > 0) {
  process.exit(1);
}
