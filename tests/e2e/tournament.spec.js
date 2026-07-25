/**
 * E2E: Tournament bracket — admin authors and advances a bracket through the
 * admin UI; the public viewer page (opened in a second browser context)
 * reflects every update live over the real SSE stream, with no manual
 * reload.
 *
 * Auth: mirrors tests/e2e/homepageEditor.spec.js's approach — mints a signed
 * frh_discord_session cookie for the admin role rather than driving the real
 * Discord OAuth flow, since app/admin/tournaments/**'s server-side gate
 * (lib/serverAuth.js's isAdminFromCookies) and the admin API's
 * resolveAdminAuth both accept a Discord admin session the same way.
 *
 * This test talks to the real admin UI, the real viewer UI, and the real
 * /api/tournaments/[id]/stream SSE route — nothing here is mocked. It
 * requires a running app (see playwright.config.js) backed by a real
 * database.
 */
import { test, expect } from '@playwright/test';
import { createHmac } from 'node:crypto';

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

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

function adminCookieValue() {
  const adminRoleId = process.env.DISCORD_ADMIN_ROLE_ID || 'admin-role-id';
  return mintSessionCookie({ discordId: 'tournament-e2e-admin', username: 'TournamentE2EAdmin', roles: [adminRoleId] });
}

async function setAdminCookie(context) {
  await context.addCookies([{
    name: COOKIE_NAME,
    value: adminCookieValue(),
    domain: 'localhost',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
  }]);
}

// Each admin match-row is `<div className="flex items-center justify-between
// gap-2">` (app/admin/tournaments/[id]/AdminClient.js) holding the
// participant's name span and, only while that match is 'ready', a "Winner"
// button as a sibling. A winning participant's name renders twice on the
// page once they've advanced (their now-decided match still shows it for
// history, and the next match they cascaded into also shows it) — scoping
// to the row that still has an active Winner button is what disambiguates
// which one to click.
async function clickWinner(page, participantName) {
  const rows = page.getByText(participantName, { exact: true }).locator('xpath=..');
  const activeRow = rows.filter({ has: page.getByRole('button', { name: 'Winner' }) });
  await activeRow.getByRole('button', { name: 'Winner' }).click();
}

test.describe('Tournament bracket — admin creates/advances, viewer follows live via SSE', () => {
  test('viewer reflects publish and every recorded winner without a manual reload', async ({ browser }) => {
    const adminContext = await browser.newContext();
    await setAdminCookie(adminContext);
    const adminPage = await adminContext.newPage();

    const viewerContext = await browser.newContext();
    const viewerPage = await viewerContext.newPage();

    let tournamentId;

    try {
      // ─── Admin: create a 4-participant tournament via the admin UI ────
      await adminPage.goto('/admin/tournaments');
      await adminPage.locator('input[placeholder="Season 4 Gauntlet"]').fill('SSE E2E Gauntlet');
      await adminPage.locator('textarea').fill('Team Alpha\nTeam Bravo\nTeam Charlie\nTeam Delta');
      await adminPage.getByRole('button', { name: 'Create Tournament' }).click();

      await adminPage.waitForURL(/\/admin\/tournaments\/[^/]+$/);
      tournamentId = adminPage.url().split('/').filter(Boolean).pop();
      expect(tournamentId).toBeTruthy();

      // ─── Admin: publish (draft -> live) ────────────────────────────────
      await adminPage.getByRole('button', { name: 'Publish' }).click();
      await expect(adminPage.getByRole('button', { name: 'Published' })).toBeVisible();

      // ─── Viewer: open the now-live tournament in a second context ─────
      // A draft tournament 404s here (docs/adr/0003/0006) — this only
      // works because publish already happened above.
      await viewerPage.goto(`/tournaments/${tournamentId}`);
      await expect(viewerPage.getByText('live', { exact: true })).toBeVisible();

      const finalColumn = viewerPage.locator(
        'div.flex.flex-col.justify-around.gap-6.shrink-0',
        { hasText: 'Final' }
      );

      // ─── Admin: round 1, match 1 — Alpha beats Bravo ───────────────────
      await clickWinner(adminPage, 'Team Alpha');

      // Viewer sees it live over SSE, with no reload: Bravo crosses out in
      // place, and Alpha's chip slides into the Final column.
      await expect(viewerPage.getByText('Team Bravo', { exact: true }))
        .toHaveClass(/line-through/, { timeout: 10000 });
      await expect(finalColumn.getByText('Team Alpha', { exact: true }))
        .toBeVisible({ timeout: 10000 });

      // ─── Admin: round 1, match 2 — Delta beats Charlie ─────────────────
      await clickWinner(adminPage, 'Team Delta');

      await expect(viewerPage.getByText('Team Charlie', { exact: true }))
        .toHaveClass(/line-through/, { timeout: 10000 });
      await expect(finalColumn.getByText('Team Delta', { exact: true }))
        .toBeVisible({ timeout: 10000 });

      // ─── Admin: the final — Alpha beats Delta ──────────────────────────
      await clickWinner(adminPage, 'Team Alpha');

      // Per ADR-0003, a completed tournament stops streaming after this
      // update — the viewer must reflect `completed` from this single
      // pushed frame, with no reconnect and no manual reload.
      await expect(viewerPage.getByText('completed', { exact: true }))
        .toBeVisible({ timeout: 10000 });
      await expect(viewerPage.getByText('Final — read only'))
        .toBeVisible({ timeout: 10000 });
      await expect(finalColumn.getByText('Team Delta', { exact: true }))
        .toHaveClass(/line-through/);
    } finally {
      if (tournamentId) {
        await adminContext.request
          .patch(`${BASE}/api/admin/tournaments/${tournamentId}`, { data: { action: 'delete' } })
          .catch(() => {});
      }
      await adminContext.close();
      await viewerContext.close();
    }
  });
});
