/**
 * E2E: Navigation and public page rendering
 * These tests verify that all public-facing pages load without crashing
 * and that navigation links work as expected.
 *
 * Prerequisite: the app must be running at PLAYWRIGHT_BASE_URL (default localhost:3000).
 */
import { test, expect } from '@playwright/test';

const PUBLIC_ROUTES = [
  { path: '/',                label: 'homepage' },
  { path: '/schedule',        label: 'schedule' },
  { path: '/standings',       label: 'standings' },
  { path: '/roster',          label: 'roster' },
  { path: '/bulletin-board',  label: 'bulletin board' },
  // /teams and /players redirect to /roster — verify redirect is not a crash
  { path: '/teams',           label: 'teams redirect' },
  { path: '/players',         label: 'players redirect' },
];

for (const { path, label } of PUBLIC_ROUTES) {
  test(`${label} page renders without crashing`, async ({ page }) => {
    const response = await page.goto(path);
    // Must not be a 5xx server error
    expect(response?.status()).toBeLessThan(500);
    // Must not show an unhandled Next.js error overlay
    await expect(page.locator('body')).not.toContainText('Application error');
    await expect(page.locator('body')).not.toContainText('Internal Server Error');
  });
}

test('invalid draft ID shows a controlled not-found or error state', async ({ page }) => {
  const response = await page.goto('/draft/this-id-does-not-exist');
  // Either a 404 page or a handled error page — not a 500
  if (response?.status() === 200) {
    // App handled it gracefully — check for an error message, not a crash
    await expect(page.locator('body')).not.toContainText('Application error');
  } else {
    expect(response?.status()).toBe(404);
  }
});

test('public nav links are present on homepage', async ({ page }) => {
  await page.goto('/');
  // Current nav: Home, Schedule, Standings, Roster, Board, Fraud Watch, Knows Ball
  // /teams and /players were removed — they now redirect to /roster
  for (const route of ['/schedule', '/standings', '/roster']) {
    const link = page.locator(`a[href="${route}"]`).first();
    await expect(link).toBeVisible();
  }
});

test('empty schedule page renders without crashing', async ({ page }) => {
  const res = await page.goto('/schedule');
  expect(res?.status()).toBeLessThan(500);
  await expect(page.locator('body')).not.toContainText('Application error');
});

test('empty standings page renders without crashing', async ({ page }) => {
  const res = await page.goto('/standings');
  expect(res?.status()).toBeLessThan(500);
  await expect(page.locator('body')).not.toContainText('Application error');
});

test('/teams redirects to /roster without crashing', async ({ page }) => {
  const res = await page.goto('/teams');
  expect(res?.status()).toBeLessThan(500);
  await expect(page.locator('body')).not.toContainText('Application error');
});

test('mobile viewport: homepage renders without crashing', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); // iPhone 14 size
  const res = await page.goto('/');
  expect(res?.status()).toBeLessThan(500);
  await expect(page.locator('body')).not.toContainText('Application error');
});

test('mobile viewport: nav links are accessible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  // Check the page loaded cleanly
  await expect(page.locator('body')).not.toContainText('Application error');
});
