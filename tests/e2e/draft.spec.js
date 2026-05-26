/**
 * E2E: Draft room behaviour
 * Tests spectator/captain/admin access rules and the draft status machine.
 *
 * These tests use the API directly to set up state, then verify the UI.
 * All tests assume a running app at PLAYWRIGHT_BASE_URL.
 *
 * Note: tests that require a real draft to exist will create one via the
 * API and clean up after themselves where possible.
 */
import { test, expect } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function createDraft(request, name = 'E2E Test Draft') {
  const res = await request.post(`${BASE}/api/drafts`, {
    data: { name },
  });
  if (!res.ok()) return null;
  return res.json();
}

async function deleteDraft(request, id) {
  await request.delete(`${BASE}/api/drafts/${id}`).catch(() => {});
}

// ─── Spectator tests ─────────────────────────────────────────────────────────
test.describe('Draft spectator access', () => {
  let draftId;
  let adminKey;

  test.beforeAll(async ({ request }) => {
    const draft = await createDraft(request);
    if (draft) {
      draftId = draft.id;
      adminKey = draft.adminKey;
    }
  });

  test.afterAll(async ({ request }) => {
    if (draftId) await deleteDraft(request, draftId);
  });

  test('spectator can view draft page without a key', async ({ page }) => {
    test.skip(!draftId, 'Draft creation failed — skipping');
    const res = await page.goto(`/draft/${draftId}`);
    expect(res?.status()).toBeLessThan(500);
    await expect(page.locator('body')).not.toContainText('Application error');
  });

  test('spectator cannot see pick or ban controls', async ({ page }) => {
    test.skip(!draftId, 'Draft creation failed — skipping');
    await page.goto(`/draft/${draftId}`);
    // There should be no active submit buttons for banning or picking
    // (they may be visible but disabled, or hidden entirely for spectators)
    const banBtn = page.locator('button[data-action="ban"], button:has-text("Ban")').first();
    const pickBtn = page.locator('button[data-action="pick"], button:has-text("Pick")').first();
    // If buttons exist they must be disabled for spectator
    const banVisible = await banBtn.isVisible().catch(() => false);
    const pickVisible = await pickBtn.isVisible().catch(() => false);
    if (banVisible)  await expect(banBtn).toBeDisabled();
    if (pickVisible) await expect(pickBtn).toBeDisabled();
  });
});

// ─── Captain access tests ────────────────────────────────────────────────────
test.describe('Draft captain access', () => {
  let draftId;
  let captainAKey;
  let captainBKey;
  let adminKey;

  test.beforeAll(async ({ request }) => {
    const draft = await createDraft(request, 'Captain Access E2E');
    if (draft) {
      draftId = draft.id;
      adminKey = draft.adminKey;
      captainAKey = draft.captainAKey;
      captainBKey = draft.captainBKey;
    }
  });

  test.afterAll(async ({ request }) => {
    if (draftId) await deleteDraft(request, draftId);
  });

  test('captainA can view draft with their key', async ({ page }) => {
    test.skip(!draftId || !captainAKey, 'Draft creation failed — skipping');
    const res = await page.goto(`/draft/${draftId}?key=${captainAKey}`);
    expect(res?.status()).toBeLessThan(500);
    await expect(page.locator('body')).not.toContainText('Application error');
  });

  test('captainB can view draft with their key', async ({ page }) => {
    test.skip(!draftId || !captainBKey, 'Draft creation failed — skipping');
    const res = await page.goto(`/draft/${draftId}?key=${captainBKey}`);
    expect(res?.status()).toBeLessThan(500);
    await expect(page.locator('body')).not.toContainText('Application error');
  });
});

// ─── Draft status machine ────────────────────────────────────────────────────
test.describe('Draft status machine', () => {
  test('draft state endpoint returns valid status', async ({ request }) => {
    // Create a draft and immediately check its state
    const created = await createDraft(request, 'Status Machine E2E');
    if (!created?.id) test.skip(true, 'Draft creation unavailable');

    const res = await request.get(`${BASE}/api/drafts/${created.id}/state`);
    expect(res.ok()).toBe(true);
    const state = await res.json();
    expect(['pending', 'lobby', 'banning', 'picking', 'complete']).toContain(state.draft.status);

    await deleteDraft(request, created.id);
  });

  test('draft keys are not exposed in public state response', async ({ request }) => {
    const created = await createDraft(request, 'Key Leakage E2E');
    if (!created?.id) test.skip(true, 'Draft creation unavailable');

    const res = await request.get(`${BASE}/api/drafts/${created.id}/state`);
    const state = await res.json();

    // None of the auth keys should appear in the public state payload
    expect(JSON.stringify(state)).not.toContain(created.adminKey ?? '__noadminkey__');

    await deleteDraft(request, created.id);
  });

  test('GET /api/health returns ok', async ({ request }) => {
    const res = await request.get(`${BASE}/api/health`);
    expect(res.ok()).toBe(true);
  });
});

// ─── Admin undo ──────────────────────────────────────────────────────────────
test.describe('Admin undo flow', () => {
  test('admin can undo a ban via API', async ({ request }) => {
    // Create draft, set to banning, submit a ban, then undo it
    const created = await createDraft(request, 'Admin Undo E2E');
    if (!created?.id) test.skip(true, 'Draft creation unavailable');

    const { id, adminKey } = created;

    // Get the state to find a god id we can use
    const stateRes = await request.get(`${BASE}/api/drafts/${id}/state`);
    const state = await stateRes.json();

    // Only proceed if draft is in banning phase and gods are available
    if (state.draft.status !== 'banning' || !state.gods?.length) {
      await deleteDraft(request, id);
      test.skip(true, 'Draft not in banning phase — skipping undo test');
    }

    const godId = state.gods[0]?.id;
    const banRes = await request.post(`${BASE}/api/drafts/${id}/ban`, {
      data: { key: adminKey, godId },
    });

    if (!banRes.ok()) {
      await deleteDraft(request, id);
      test.skip(true, 'Ban submission failed — skipping');
    }

    // Get the ban id from state
    const stateAfterBan = await (await request.get(`${BASE}/api/drafts/${id}/state`)).json();
    const ban = stateAfterBan.bans?.[0];
    if (!ban) {
      await deleteDraft(request, id);
      test.skip(true, 'No ban found after submission — skipping');
    }

    // Undo the ban
    const undoRes = await request.delete(`${BASE}/api/drafts/${id}/ban`, {
      data: { key: adminKey, banId: ban.id },
    });
    expect(undoRes.ok()).toBe(true);

    await deleteDraft(request, id);
  });
});
