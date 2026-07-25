/**
 * API tests for the Tournament bracket feature (Phase 1 — workstream F).
 * Covers: app/api/admin/tournaments/route.js               (create)
 *         app/api/admin/tournaments/[id]/route.js           (PATCH actions)
 *         app/api/tournaments/route.js                      (public list)
 *         app/api/tournaments/[id]/state/route.js            (public state)
 *         app/api/tournaments/[id]/stream/route.js           (SSE — 404 branch only)
 *
 * lib/bracketEngine.js already has its own thorough unit tests
 * (tests/unit/bracketEngine.test.js) — this file is about the API layer:
 * running a real bracket through the HTTP routes and asserting on status
 * codes / response bodies, plus the admin auth + draft-visibility rules
 * layered on top by workstreams B and C.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeReq, makeInvalidJsonReq, unwrap } from './_helpers.js';

// ─── Mock next/server ────────────────────────────────────────────────────────
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({ _body: body, _status: init?.status ?? 200 })),
  },
}));

// ─── Mock resolveAdminAuth (admin routes only) ───────────────────────────────
vi.mock('@/lib/resolveAuth', () => ({
  resolveAdminAuth: vi.fn(async () => null), // null = authorized by default
}));

// ─── Fake @/lib/db ────────────────────────────────────────────────────────────
//
// Every other tests/api/*.test.js file stubs prisma calls one at a time with
// vi.fn().mockResolvedValueOnce(...). That works when a route makes a
// handful of independent calls, but this suite has to run one tournament
// through many sequential route calls (create -> publish -> recordWinner x3)
// where each call's effect (a round-1 win cascading into the next round's
// slot) has to actually be visible to the *next* call — that's what real
// relational state gives you and a per-call stub chain doesn't, short of
// reimplementing the cascade in the test itself. So this file swaps in a
// small in-memory stand-in for the four Prisma models the tournament routes
// touch (Tournament/Participant/BracketMatch), rather than the codebase's
// usual call-by-call vi.fn() stubs. Everything else — the route handlers,
// lib/tournamentState.js, and lib/bracketEngine.js — runs unmocked, so the
// bracket math and completion detection are exercised for real.
function makeFakeDb() {
  let tournaments = [];
  let participants = [];
  let matches = [];
  let counter = 0;
  const nextId = (prefix) => `${prefix}-${++counter}`;

  const clone = (row) => (row ? { ...row } : row);

  function applyUpdateData(row, data) {
    for (const [key, val] of Object.entries(data)) {
      if (val && typeof val === 'object' && 'increment' in val) {
        row[key] = (row[key] || 0) + val.increment;
      } else {
        row[key] = val;
      }
    }
  }

  function matchesWhereClause(row, where) {
    return Object.entries(where).every(([key, cond]) => {
      if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
        if ('in' in cond) return cond.in.includes(row[key]);
        if ('gt' in cond) return row[key] > cond.gt;
        if ('gte' in cond) return row[key] >= cond.gte;
        if ('lt' in cond) return row[key] < cond.lt;
        if ('lte' in cond) return row[key] <= cond.lte;
        return JSON.stringify(row[key]) === JSON.stringify(cond);
      }
      return row[key] === cond;
    });
  }

  const participantsFor = (tournamentId) =>
    participants.filter((p) => p.tournamentId === tournamentId).map(clone);
  const matchesFor = (tournamentId) =>
    matches.filter((m) => m.tournamentId === tournamentId).map(clone);

  function decorate(row, args = {}) {
    let result = { ...row };
    if (args.include?.participants) {
      const opts = args.include.participants;
      let parts = participantsFor(row.id);
      if (opts && opts.select) {
        const keys = Object.keys(opts.select).filter((k) => opts.select[k]);
        parts = parts.map((p) => Object.fromEntries(keys.map((k) => [k, p[k]])));
      }
      result.participants = parts;
    }
    if (args.include?.matches) {
      result.matches = matchesFor(row.id);
    }
    if (args.select) {
      const selected = {};
      for (const key of Object.keys(args.select)) {
        if (!args.select[key]) continue;
        selected[key] = result[key];
      }
      result = selected;
    }
    return result;
  }

  const db = {
    tournament: {
      create: async ({ data }) => {
        const row = { id: nextId('tournament'), createdAt: new Date(), ...data };
        tournaments.push(row);
        return clone(row);
      },
      findUnique: async (args) => {
        const row = tournaments.find((t) => t.id === args.where.id);
        if (!row) return null;
        return decorate(row, args);
      },
      findMany: async (args = {}) => {
        let rows = tournaments.slice();
        if (args.where) rows = rows.filter((r) => matchesWhereClause(r, args.where));
        if (args.orderBy?.createdAt === 'desc') rows = rows.sort((a, b) => b.createdAt - a.createdAt);
        return rows.map((r) => decorate(r, args));
      },
      update: async ({ where, data }) => {
        const row = tournaments.find((t) => t.id === where.id);
        applyUpdateData(row, data);
        return clone(row);
      },
      updateMany: async ({ where, data }) => {
        const targets = tournaments.filter((t) => matchesWhereClause(t, where));
        targets.forEach((t) => applyUpdateData(t, data));
        return { count: targets.length };
      },
      delete: async ({ where }) => {
        const idx = tournaments.findIndex((t) => t.id === where.id);
        const [row] = tournaments.splice(idx, 1);
        participants = participants.filter((p) => p.tournamentId !== where.id);
        matches = matches.filter((m) => m.tournamentId !== where.id);
        return clone(row);
      },
    },
    participant: {
      findUnique: async ({ where }) => clone(participants.find((p) => p.id === where.id) ?? null),
      findFirst: async ({ where }) => clone(participants.find((p) => matchesWhereClause(p, where)) ?? null),
      findMany: async ({ where } = {}) =>
        participants.filter((p) => (where ? matchesWhereClause(p, where) : true)).map(clone),
      update: async ({ where, data }) => {
        const row = participants.find((p) => p.id === where.id);
        applyUpdateData(row, data);
        return clone(row);
      },
      createMany: async ({ data }) => {
        participants.push(...data.map((d) => ({ ...d })));
        return { count: data.length };
      },
      deleteMany: async ({ where } = {}) => {
        const before = participants.length;
        participants = participants.filter((p) => !(where ? matchesWhereClause(p, where) : true));
        return { count: before - participants.length };
      },
    },
    bracketMatch: {
      findMany: async ({ where } = {}) =>
        matches.filter((m) => (where ? matchesWhereClause(m, where) : true)).map(clone),
      update: async ({ where, data }) => {
        const row = matches.find((m) => m.id === where.id);
        applyUpdateData(row, data);
        return clone(row);
      },
      updateMany: async ({ where, data }) => {
        const targets = matches.filter((m) => matchesWhereClause(m, where));
        targets.forEach((m) => applyUpdateData(m, data));
        return { count: targets.length };
      },
      createMany: async ({ data }) => {
        matches.push(...data.map((d) => ({ ...d })));
        return { count: data.length };
      },
      deleteMany: async ({ where } = {}) => {
        const before = matches.length;
        matches = matches.filter((m) => !(where ? matchesWhereClause(m, where) : true));
        return { count: before - matches.length };
      },
    },
    $transaction: async (fnOrArr) => {
      if (typeof fnOrArr !== 'function') {
        throw new Error('Fake db only supports interactive $transaction callbacks');
      }
      return fnOrArr(db);
    },
    __reset: () => {
      tournaments = [];
      participants = [];
      matches = [];
      counter = 0;
    },
  };

  return db;
}

vi.mock('@/lib/db', () => {
  const db = makeFakeDb();
  return { default: db };
});

const { default: prisma } = await import('@/lib/db');
const { POST: adminCreatePOST } = await import('@/app/api/admin/tournaments/route.js');
const { PATCH: adminPatch } = await import('@/app/api/admin/tournaments/[id]/route.js');
const { GET: publicListGET } = await import('@/app/api/tournaments/route.js');
const { GET: stateGET } = await import('@/app/api/tournaments/[id]/state/route.js');
const { GET: streamGET } = await import('@/app/api/tournaments/[id]/stream/route.js');

beforeEach(() => {
  prisma.__reset();
  vi.clearAllMocks();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function createTournament(names = ['Alpha', 'Bravo', 'Charlie', 'Delta']) {
  const res = await adminCreatePOST(makeReq({ name: 'E2E Bracket', participantNames: names }));
  const { status, body } = unwrap(res);
  expect(status).toBe(201);
  return body.id;
}

async function publish(tournamentId) {
  return adminPatch(makeReq({ action: 'publish' }), { params: { id: tournamentId } });
}

async function recordWinner(tournamentId, matchId, winnerParticipantId) {
  return adminPatch(
    makeReq({ action: 'recordWinner', matchId, winnerParticipantId }),
    { params: { id: tournamentId } }
  );
}

async function round1Matches(tournamentId) {
  const all = await prisma.bracketMatch.findMany({ where: { tournamentId } });
  return all.filter((m) => m.round === 1).sort((a, b) => a.position - b.position);
}

async function finalMatch(tournamentId) {
  const all = await prisma.bracketMatch.findMany({ where: { tournamentId } });
  return all.find((m) => m.nextMatchId === null);
}

async function regenerate(tournamentId, participantNames) {
  return adminPatch(
    makeReq({ action: 'regenerate', participantNames }),
    { params: { id: tournamentId } }
  );
}

// ─── Create ───────────────────────────────────────────────────────────────────
describe('POST /api/admin/tournaments', () => {
  it('returns 400 for invalid JSON', async () => {
    const res = await adminCreatePOST(makeInvalidJsonReq());
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 400 when participantNames is not a power of two', async () => {
    const res = await adminCreatePOST(makeReq({ name: 'Odd Bracket', participantNames: ['A', 'B', 'C'] }));
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 400 when the tournament name exceeds 100 characters', async () => {
    const res = await adminCreatePOST(makeReq({ name: 'x'.repeat(101), participantNames: ['A', 'B'] }));
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 400 when a participant name exceeds 100 characters', async () => {
    const res = await adminCreatePOST(makeReq({ name: 'Bracket', participantNames: ['A', 'x'.repeat(101)] }));
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 400 when participantNames exceeds the 128-participant cap', async () => {
    const res = await adminCreatePOST(
      makeReq({ name: 'Huge Bracket', participantNames: Array.from({ length: 256 }, (_, i) => `P${i}`) })
    );
    expect(unwrap(res).status).toBe(400);
  });

  it('creates a draft tournament with a generated bracket', async () => {
    const tournamentId = await createTournament();
    const matchesRows = await prisma.bracketMatch.findMany({ where: { tournamentId } });
    // 4 participants -> 2 round-1 matches + 1 final = 3 matches total.
    expect(matchesRows).toHaveLength(3);
  });
});

// ─── Draft visibility (docs/adr/0003, docs/adr/0006) ────────────────────────
describe('draft tournament visibility', () => {
  it('is excluded from the public list, and 404s the state and stream routes', async () => {
    const tournamentId = await createTournament();

    const list = unwrap(await publicListGET()).body;
    expect(list.find((t) => t.id === tournamentId)).toBeUndefined();

    const stateRes = unwrap(await stateGET({}, { params: { id: tournamentId } }));
    expect(stateRes.status).toBe(404);

    const streamRes = unwrap(await streamGET({}, { params: { id: tournamentId } }));
    expect(streamRes.status).toBe(404);
  });
});

// ─── recordWinner requires `live` (docs/tournament-bracket-implementation-plan.md, workstream B) ─
describe('PATCH recordWinner before publish', () => {
  it('is rejected while the tournament is still draft', async () => {
    const tournamentId = await createTournament();
    const [match0] = await round1Matches(tournamentId);

    const res = unwrap(await recordWinner(tournamentId, match0.id, match0.slot1ParticipantId));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/live/i);
  });
});

// ─── Full lifecycle ──────────────────────────────────────────────────────────
describe('full 4-participant bracket lifecycle', () => {
  it('create -> publish -> record every winner -> Tournament.status reaches completed', async () => {
    const tournamentId = await createTournament(['Alpha', 'Bravo', 'Charlie', 'Delta']);

    const publishRes = unwrap(await publish(tournamentId));
    expect(publishRes.status).toBe(200);
    expect(publishRes.body.status).toBe('live');

    // Now published: the public surfaces should pick it up.
    const listAfterPublish = unwrap(await publicListGET()).body;
    expect(listAfterPublish.map((t) => t.id)).toContain(tournamentId);

    const stateAfterPublish = unwrap(await stateGET({}, { params: { id: tournamentId } }));
    expect(stateAfterPublish.status).toBe(200);
    expect(stateAfterPublish.body.tournament.status).toBe('live');
    expect(stateAfterPublish.body.matches.filter((m) => m.state === 'ready')).toHaveLength(2);

    const [match0, match1] = await round1Matches(tournamentId);
    const final = await finalMatch(tournamentId);

    // Round 1, match 0: the slot1 participant (Alpha) wins.
    const win0 = unwrap(await recordWinner(tournamentId, match0.id, match0.slot1ParticipantId));
    expect(win0.status).toBe(200);
    expect(win0.body.status).toBe('live'); // not complete yet

    // Round 1, match 1: the slot2 participant (Delta) wins — exercises the
    // nextMatchSlot === 2 cascade path, not just nextMatchSlot === 1.
    const win1 = unwrap(await recordWinner(tournamentId, match1.id, match1.slot2ParticipantId));
    expect(win1.status).toBe(200);
    expect(win1.body.status).toBe('live');

    // Both round-1 winners should have cascaded into the final's two slots.
    const finalAfterRound1 = (await prisma.bracketMatch.findMany({ where: { tournamentId } }))
      .find((m) => m.id === final.id);
    expect(finalAfterRound1.slot1ParticipantId).toBe(match0.slot1ParticipantId);
    expect(finalAfterRound1.slot2ParticipantId).toBe(match1.slot2ParticipantId);

    // Recording the final's winner should flip Tournament.status to
    // completed, per bracketEngine.isTournamentComplete semantics.
    const winFinal = unwrap(
      await recordWinner(tournamentId, final.id, finalAfterRound1.slot1ParticipantId)
    );
    expect(winFinal.status).toBe(200);
    expect(winFinal.body.status).toBe('completed');

    // A completed tournament stays visible on both public surfaces (ADR-0003).
    const stateAfterComplete = unwrap(await stateGET({}, { params: { id: tournamentId } }));
    expect(stateAfterComplete.status).toBe(200);
    expect(stateAfterComplete.body.tournament.status).toBe('completed');
    expect(stateAfterComplete.body.matches.every((m) => m.state === 'decided')).toBe(true);

    const listAfterComplete = unwrap(await publicListGET()).body;
    expect(listAfterComplete.map((t) => t.id)).toContain(tournamentId);
  });
});

// ─── Edit/reseed lock once a match is decided (docs/adr/0008) ───────────────
describe('editParticipant / reseed lock after a decided match', () => {
  it('rejects editing or reseeding a participant whose match has a recorded winner', async () => {
    const tournamentId = await createTournament();
    await publish(tournamentId);

    const [match0] = await round1Matches(tournamentId);
    const winnerId = match0.slot1ParticipantId;
    const loserId = match0.slot2ParticipantId;

    const winRes = unwrap(await recordWinner(tournamentId, match0.id, winnerId));
    expect(winRes.status).toBe(200);

    // The winner's slot is locked...
    const editWinner = unwrap(
      await adminPatch(
        makeReq({ action: 'editParticipant', participantId: winnerId, name: 'Renamed Winner' }),
        { params: { id: tournamentId } }
      )
    );
    expect(editWinner.status).toBe(400);
    expect(editWinner.body.error).toMatch(/decided/i);

    // ...and so is the loser's — ADR-0008 says the lock applies to both
    // slots on a decided match, not just the winner who advances.
    const reseedLoser = unwrap(
      await adminPatch(
        makeReq({ action: 'reseed', participantId: loserId, seed: 3 }),
        { params: { id: tournamentId } }
      )
    );
    expect(reseedLoser.status).toBe(400);
    expect(reseedLoser.body.error).toMatch(/decided/i);
  });

  it('still allows editing a participant whose match is not yet decided', async () => {
    const tournamentId = await createTournament();
    await publish(tournamentId);

    const [match0] = await round1Matches(tournamentId);
    const untouchedParticipantId = match0.slot1ParticipantId;

    const editRes = unwrap(
      await adminPatch(
        makeReq({ action: 'editParticipant', participantId: untouchedParticipantId, name: 'Still Editable' }),
        { params: { id: tournamentId } }
      )
    );
    expect(editRes.status).toBe(200);
  });

  it('rejects editParticipant when the new name exceeds 100 characters', async () => {
    const tournamentId = await createTournament();
    await publish(tournamentId);

    const [match0] = await round1Matches(tournamentId);
    const participantId = match0.slot1ParticipantId;

    const editRes = unwrap(
      await adminPatch(
        makeReq({ action: 'editParticipant', participantId, name: 'x'.repeat(101) }),
        { params: { id: tournamentId } }
      )
    );
    expect(editRes.status).toBe(400);
  });
});

// ─── regenerate: draft-only rebuild of participants + bracket ──────────────
describe('PATCH regenerate', () => {
  it('rebuilds participants and bracket while draft, and bumps version', async () => {
    const tournamentId = await createTournament(['Alpha', 'Bravo', 'Charlie', 'Delta']);
    const before = await prisma.tournament.findUnique({ where: { id: tournamentId } });

    const res = unwrap(
      await regenerate(tournamentId, ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'])
    );
    expect(res.status).toBe(200);
    expect(res.body.version).toBe(before.version + 1);

    const participants = await prisma.participant.findMany({ where: { tournamentId } });
    expect(participants).toHaveLength(8);
    expect(participants.map((p) => p.name).sort()).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);

    // 8 participants -> 4 round-1 + 2 round-2 + 1 final = 7 matches total.
    const matchRows = await prisma.bracketMatch.findMany({ where: { tournamentId } });
    expect(matchRows).toHaveLength(7);
  });

  it('rejects regenerate once the tournament is live', async () => {
    const tournamentId = await createTournament();
    await publish(tournamentId);

    const res = unwrap(await regenerate(tournamentId, ['A', 'B', 'C', 'D']));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/draft/i);
  });

  it('rejects regenerate once the tournament is completed', async () => {
    const tournamentId = await createTournament(['Alpha', 'Bravo']);
    await publish(tournamentId);

    const [match0] = await round1Matches(tournamentId);
    const winRes = unwrap(await recordWinner(tournamentId, match0.id, match0.slot1ParticipantId));
    expect(winRes.status).toBe(200);
    expect(winRes.body.status).toBe('completed');

    const res = unwrap(await regenerate(tournamentId, ['A', 'B', 'C', 'D']));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/draft/i);
  });

  it('rejects a non-power-of-2 participantNames array the same way POST does', async () => {
    const tournamentId = await createTournament();

    const res = unwrap(await regenerate(tournamentId, ['A', 'B', 'C']));
    expect(res.status).toBe(400);
  });
});
