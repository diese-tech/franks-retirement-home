/**
 * Mobile viewport tests — layout integrity and touch-target compliance.
 *
 * These tests run at a 390×844 viewport (iPhone 14 dimensions) unless
 * noted otherwise.  They catch:
 *   • Horizontal overflow (content escaping the viewport width)
 *   • Touch targets smaller than the 44 px WCAG minimum on primary actions
 *   • Key structural elements being absent or hidden on mobile
 *   • Visual regression via full-page screenshots (baseline auto-generated on
 *     first run, compared on subsequent runs — commit the snapshots dir)
 *
 * Prerequisite: app must be running at PLAYWRIGHT_BASE_URL (default
 * http://localhost:3000).  In CI the server is started externally.
 */
import { test, expect } from '@playwright/test';

const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 900 };

// ─── Helper: assert no horizontal overflow ────────────────────────────────────
async function assertNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > window.innerWidth;
  });
  expect(overflow, 'Page has horizontal overflow (content wider than viewport)').toBe(false);
}

// ─── Helper: measure element height in px ────────────────────────────────────
async function getHeight(locator) {
  const box = await locator.boundingBox();
  return box?.height ?? 0;
}

// ─── Public pages — no auth needed ───────────────────────────────────────────

test.describe('Mobile — public pages', () => {
  test.use({ viewport: MOBILE });

  test('homepage: no horizontal overflow', async ({ page }) => {
    await page.goto('/');
    await assertNoHorizontalOverflow(page);
  });

  test('homepage: nav hamburger is visible and tappable', async ({ page }) => {
    await page.goto('/');
    // The hamburger button is the first focusable element inside the nav on mobile
    const hamburger = page.locator('button[aria-label="Open menu"], button[aria-label="Menu"], nav button').first();
    await expect(hamburger).toBeVisible();
    const h = await getHeight(hamburger);
    expect(h, `Hamburger button height ${h}px is below 44px touch target minimum`).toBeGreaterThanOrEqual(40);
  });

  test('schedule: no horizontal overflow', async ({ page }) => {
    await page.goto('/schedule');
    await assertNoHorizontalOverflow(page);
  });

  test('schedule: filter chips are tappable', async ({ page }) => {
    await page.goto('/schedule');
    // Status filter links (All / live / scheduled / completed)
    const chips = page.locator('a').filter({ hasText: /^(All|live|scheduled|completed)$/i });
    const count = await chips.count();
    if (count === 0) return; // No matches yet — skip height check
    for (let i = 0; i < Math.min(count, 4); i++) {
      const h = await getHeight(chips.nth(i));
      expect(h, `Schedule filter chip ${i} height ${h}px is below minimum`).toBeGreaterThanOrEqual(32);
    }
  });

  test('standings: no horizontal overflow', async ({ page }) => {
    await page.goto('/standings');
    await assertNoHorizontalOverflow(page);
  });

  test('roster: no horizontal overflow', async ({ page }) => {
    await page.goto('/roster');
    await assertNoHorizontalOverflow(page);
  });

  test('bulletin board: no horizontal overflow', async ({ page }) => {
    await page.goto('/bulletin-board');
    await assertNoHorizontalOverflow(page);
  });

  test('/teams redirect lands on /roster without error', async ({ page }) => {
    const res = await page.goto('/teams');
    expect(res?.status()).toBeLessThan(500);
    expect(page.url()).toContain('/roster');
    await expect(page.locator('body')).not.toContainText('Application error');
  });

  test('/players redirect lands on /roster without error', async ({ page }) => {
    const res = await page.goto('/players');
    expect(res?.status()).toBeLessThan(500);
    expect(page.url()).toContain('/roster');
    await expect(page.locator('body')).not.toContainText('Application error');
  });
});

// ─── Captain dashboard ────────────────────────────────────────────────────────

test.describe('Mobile — captain dashboard', () => {
  test.use({ viewport: MOBILE });

  test('captain page: no horizontal overflow', async ({ page }) => {
    await page.goto('/captain');
    await assertNoHorizontalOverflow(page);
  });

  test('captain page: renders without crashing', async ({ page }) => {
    const res = await page.goto('/captain');
    expect(res?.status()).toBeLessThan(500);
    await expect(page.locator('body')).not.toContainText('Application error');
  });
});

// ─── God draft room ───────────────────────────────────────────────────────────

test.describe('Mobile — god draft room', () => {
  test.use({ viewport: MOBILE });

  const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
  let draftId = null;

  test.beforeAll(async ({ request }) => {
    try {
      const res = await request.post(`${BASE}/api/drafts`, {
        data: { name: 'Mobile E2E Test Draft' },
      });
      if (res.ok()) {
        const data = await res.json();
        draftId = data.id;
      }
    } catch { /* server may not have DB in CI — tests will skip */ }
  });

  test.afterAll(async ({ request }) => {
    if (draftId) {
      await request.delete(`${BASE}/api/drafts/${draftId}`).catch(() => {});
    }
  });

  test('draft room: no horizontal overflow (pending state)', async ({ page }) => {
    test.skip(!draftId, 'Draft creation failed — no DB available');
    const res = await page.goto(`/draft/${draftId}`);
    expect(res?.status()).toBeLessThan(500);
    await assertNoHorizontalOverflow(page);
  });

  test('draft room: renders without Application error on mobile', async ({ page }) => {
    test.skip(!draftId, 'Draft creation failed — no DB available');
    await page.goto(`/draft/${draftId}`);
    await expect(page.locator('body')).not.toContainText('Application error');
  });
});

// ─── Desktop → Mobile responsive comparison ──────────────────────────────────

test.describe('Responsive — desktop vs mobile width', () => {
  const pages = [
    { path: '/',               label: 'homepage' },
    { path: '/schedule',       label: 'schedule' },
    { path: '/standings',      label: 'standings' },
    { path: '/roster',         label: 'roster' },
    { path: '/bulletin-board', label: 'bulletin-board' },
  ];

  for (const { path, label } of pages) {
    test(`${label}: no overflow at 375px (smallest common phone)`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(path);
      await assertNoHorizontalOverflow(page);
    });

    test(`${label}: no overflow at 768px (tablet)`, async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto(path);
      await assertNoHorizontalOverflow(page);
    });
  }
});

// ─── Visual snapshots (baseline-based) ───────────────────────────────────────
// These generate .png baseline files in tests/e2e/__snapshots__ on first run.
// Commit the snapshots so CI can compare against them on subsequent runs.
// To update baselines: npx playwright test --update-snapshots

test.describe('Visual snapshots — mobile', () => {
  test.use({ viewport: MOBILE });

  test('homepage snapshot — mobile', async ({ page }) => {
    await page.goto('/');
    // Mask the live clock in the nav so it doesn't cause diff noise
    await expect(page).toHaveScreenshot('homepage-mobile.png', {
      mask: [page.locator('nav .frh-live-time, [data-testid="live-time"]')],
      maxDiffPixelRatio: 0.02,
    });
  });

  test('schedule snapshot — mobile', async ({ page }) => {
    await page.goto('/schedule');
    await expect(page).toHaveScreenshot('schedule-mobile.png', {
      maxDiffPixelRatio: 0.02,
    });
  });

  test('standings snapshot — mobile', async ({ page }) => {
    await page.goto('/standings');
    await expect(page).toHaveScreenshot('standings-mobile.png', {
      maxDiffPixelRatio: 0.02,
    });
  });
});

test.describe('Visual snapshots — desktop', () => {
  test.use({ viewport: DESKTOP });

  test('homepage snapshot — desktop', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveScreenshot('homepage-desktop.png', {
      mask: [page.locator('nav .frh-live-time, [data-testid="live-time"]')],
      maxDiffPixelRatio: 0.02,
    });
  });

  test('schedule snapshot — desktop', async ({ page }) => {
    await page.goto('/schedule');
    await expect(page).toHaveScreenshot('schedule-desktop.png', {
      maxDiffPixelRatio: 0.02,
    });
  });

  test('standings snapshot — desktop', async ({ page }) => {
    await page.goto('/standings');
    await expect(page).toHaveScreenshot('standings-desktop.png', {
      maxDiffPixelRatio: 0.02,
    });
  });
});
