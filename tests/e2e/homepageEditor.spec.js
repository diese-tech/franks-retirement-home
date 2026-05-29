/**
 * E2E: Homepage inline editor — Discord admin gate
 *
 * Injects a real HMAC-signed frh_discord_session cookie to simulate Discord login
 * without needing an actual OAuth flow. Uses DISCORD_SESSION_SECRET from env.
 *
 * Test structure:
 *  - Admin user  → sees sticky editor toolbar, can edit inline fields
 *  - No cookie   → sees only public homepage (no toolbar)
 *  - Captain     → has Discord session but no admin role, sees no toolbar
 */
import { test, expect } from '@playwright/test';
import { createHmac } from 'node:crypto';

// ─── Cookie helper ───────────────────────────────────────────────────────────

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
  // Has a valid Discord session but NOT the admin role
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

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe('Homepage editor — admin user', () => {
  test.beforeEach(async ({ context }) => {
    await setAdminCookie(context);
  });

  test('admin sees sticky editor toolbar on homepage', async ({ page }) => {
    await page.goto('/');
    const toolbar = page.locator('[data-testid="editor-toolbar"]');
    await expect(toolbar).toBeVisible();
    await expect(toolbar.locator('text=Save Draft')).toBeVisible();
    await expect(toolbar.locator('text=Publish')).toBeVisible();
    await expect(toolbar.locator('text=Reset to Default')).toBeVisible();
  });

  test('admin editor mode banner is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=ADMIN EDITOR MODE')).toBeVisible();
  });

  test('Save Draft button calls homepage-content API', async ({ page }) => {
    const requests = [];
    page.on('request', req => {
      if (req.url().includes('/api/admin/homepage-content') && req.method() === 'POST') {
        requests.push(req);
      }
    });

    await page.goto('/');
    const toolbar = page.locator('[data-testid="editor-toolbar"]');
    await expect(toolbar).toBeVisible();
    await page.locator('button:has-text("Save Draft")').first().click();

    // Wait for network request (or status change)
    await page.waitForTimeout(1000);

    // API was called or toolbar shows a save-related state
    const hasSavedText = await page.locator('text=Draft saved').isVisible().catch(() => false);
    const apiCalled = requests.length > 0;
    expect(hasSavedText || apiCalled).toBe(true);
  });

  test('Preview button opens /?preview=draft in new tab', async ({ page, context }) => {
    await page.goto('/');
    const [newTab] = await Promise.all([
      context.waitForEvent('page'),
      page.locator('button:has-text("Preview Public")').click(),
    ]);
    await expect(newTab.url()).toContain('preview=draft');
    await newTab.close();
  });
});

test.describe('Homepage editor — non-admin user (no cookie)', () => {
  test('public visitor sees no editor toolbar', async ({ page }) => {
    // No cookie set — pure public visitor
    await page.goto('/');
    const toolbar = page.locator('[data-testid="editor-toolbar"]');
    await expect(toolbar).not.toBeVisible();
  });

  test('public visitor sees no ADMIN EDITOR MODE banner', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=ADMIN EDITOR MODE')).not.toBeVisible();
  });

  test('homepage renders without crashing for anonymous visitor', async ({ page }) => {
    const res = await page.goto('/');
    expect(res?.status()).toBeLessThan(500);
    await expect(page.locator('body')).not.toContainText('Application error');
  });
});

test.describe('Homepage editor — captain (non-admin Discord session)', () => {
  test.beforeEach(async ({ context }) => {
    await setCaptainCookie(context);
  });

  test('captain with non-admin role sees no editor toolbar', async ({ page }) => {
    await page.goto('/');
    const toolbar = page.locator('[data-testid="editor-toolbar"]');
    await expect(toolbar).not.toBeVisible();
  });
});
