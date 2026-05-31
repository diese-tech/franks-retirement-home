/**
 * E2E: Homepage editor - Discord admin gate
 *
 * Injects a signed frh_discord_session cookie to simulate Discord login
 * without needing the OAuth flow.
 */
import { test, expect } from '@playwright/test';
import { createHmac } from 'node:crypto';

const COOKIE_NAME = 'frh_discord_session';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function base64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function mintSessionCookie({ discordId, username, roles = [] }) {
  const secret = process.env.DISCORD_SESSION_SECRET || 'dev-only-discord-insecure-secret';
  const payload = JSON.stringify({ discordId, username, roles, exp: Date.now() + SESSION_TTL_MS });
  const encoded = base64url(Buffer.from(payload, 'utf8'));
  const sig = base64url(createHmac('sha256', secret).update(encoded).digest());
  return `${encoded}.${sig}`;
}

function adminCookie() {
  const adminRoleId = process.env.DISCORD_ADMIN_ROLE_ID || 'admin-role-id';
  return mintSessionCookie({ discordId: 'admin-1', username: 'AdminUser', roles: [adminRoleId] });
}

function captainCookie() {
  return mintSessionCookie({ discordId: 'captain-1', username: 'CaptainUser', roles: ['captain-role-only'] });
}

async function setAdminCookie(context) {
  await context.addCookies([{
    name: COOKIE_NAME,
    value: adminCookie(),
    domain: 'localhost',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
  }]);
}

async function setCaptainCookie(context) {
  await context.addCookies([{
    name: COOKIE_NAME,
    value: captainCookie(),
    domain: 'localhost',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
  }]);
}

test.describe('Homepage editor - admin user', () => {
  test.beforeEach(async ({ context }) => {
    await setAdminCookie(context);
  });

  test('admin sees edit toggle on homepage', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-testid="homepage-edit-toggle"]')).toBeVisible();
  });

  test('admin can enter editor mode from homepage', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-testid="homepage-edit-toggle"]').click();

    const toolbar = page.locator('[data-testid="editor-toolbar"]');
    await expect(toolbar).toBeVisible();
    await expect(page.locator('text=ADMIN EDITOR MODE')).toBeVisible();
    await expect(page.locator('button:has-text("Save")')).toBeVisible();
    await expect(page.locator('button:has-text("Publish")')).toBeVisible();
    await expect(page.locator('button:has-text("Reset")')).toBeVisible();
  });

  test('save button calls homepage-content API', async ({ page }) => {
    const requests = [];
    page.on('request', req => {
      if (req.url().includes('/api/admin/homepage-content') && req.method() === 'POST') {
        requests.push(req);
      }
    });

    await page.goto('/');
    await page.locator('[data-testid="homepage-edit-toggle"]').click();
    await expect(page.locator('[data-testid="editor-toolbar"]')).toBeVisible();
    await page.locator('button:has-text("Save")').first().click();

    await page.waitForTimeout(1000);

    const hasSavedText = await page.locator('text=Draft saved').isVisible().catch(() => false);
    expect(hasSavedText || requests.length > 0).toBe(true);
  });

  test('preview button opens draft in a public preview mode', async ({ page, context }) => {
    await page.goto('/');
    await page.locator('[data-testid="homepage-edit-toggle"]').click();

    const [newTab] = await Promise.all([
      context.waitForEvent('page'),
      page.locator('button:has-text("Preview")').click(),
    ]);

    await expect(newTab).toHaveURL(/preview=draft/);
    await expect(newTab.locator('[data-testid="editor-toolbar"]')).not.toBeVisible();
    await expect(newTab.locator('[data-testid="homepage-edit-toggle"]')).not.toBeVisible();
    await expect(newTab.locator('text=ADMIN EDITOR MODE')).not.toBeVisible();
    await newTab.close();
  });
});

test.describe('Homepage editor - non-admin user', () => {
  test('public visitor sees no editor controls', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-testid="editor-toolbar"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="homepage-edit-toggle"]')).not.toBeVisible();
    await expect(page.locator('text=ADMIN EDITOR MODE')).not.toBeVisible();
  });

  test('homepage renders without crashing for anonymous visitor', async ({ page }) => {
    const res = await page.goto('/');
    expect(res?.status()).toBeLessThan(500);
    await expect(page.locator('body')).not.toContainText('Application error');
  });
});

test.describe('Homepage editor - captain user', () => {
  test.beforeEach(async ({ context }) => {
    await setCaptainCookie(context);
  });

  test('captain with non-admin role sees no editor controls', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-testid="editor-toolbar"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="homepage-edit-toggle"]')).not.toBeVisible();
  });
});
