// e2e/client-switch-transition.spec.ts
//
// Part 1 — branded workspace-switch transition
// (app/components/admin/ClientSwitchOverlay.tsx +
//  app/components/admin/SelectedClientContext.tsx's `lastSwitch`).
//
// All fixture clients are created/torn down per test — see e2e/fixtures.ts
// for why (no separate test DB; this writes to the same Neon instance local
// dev uses). UNEXECUTED as written — see the note at the bottom of this
// file's companion spec, client-health-monitoring.spec.ts, for why running
// this is a deliberate decision, not an automatic next step.

import { test, expect } from '@playwright/test';
import {
  seedFixtureClient,
  teardownFixtures,
  loginAsTestAdmin,
  type FixtureClient,
} from './fixtures';

test.describe('branded workspace-switch transition', () => {
  let clientA: FixtureClient;
  let clientB: FixtureClient;
  let clientNoLogo: FixtureClient;

  test.beforeAll(async () => {
    // Display names match the task's own examples; the underlying DB rows
    // are always fixture-prefixed (see e2e/fixtures.ts) — these are NOT
    // assumed to be real pre-existing "Meldex"/"HomeWise" clients.
    //
    // Logo host matters here: next.config.ts only allow-lists
    // res.cloudinary.com (real client logos are uploaded to Cloudinary —
    // see that file's comment); next/image throws an uncaught error for
    // any other remote host, which is exactly what crashed these tests
    // the first time round (dummyimage.com, unconfigured). Cloudinary's
    // own public "demo" cloud sample image is a real, stable asset on an
    // allow-listed host, not a dummy/placeholder service.
    const CLOUDINARY_DEMO_IMAGE = 'https://res.cloudinary.com/demo/image/upload/sample.jpg';
    clientA = await seedFixtureClient('Meldex Industries', CLOUDINARY_DEMO_IMAGE);
    clientB = await seedFixtureClient('HomeWise', CLOUDINARY_DEMO_IMAGE);
    clientNoLogo = await seedFixtureClient('Acme Testing Co', null);
  });

  test.afterAll(async () => {
    await teardownFixtures();
  });

  test.beforeEach(async ({ page }) => {
    await loginAsTestAdmin(page);
    await page.goto('/dashboard');
  });

  // The context-switcher button only renders once AdminHeader's own data
  // (employeeProfile / clientsPayload SWR fetches) has settled — clicking
  // immediately after a goto() can race a re-render and hit a
  // mid-replacement DOM node ("element was detached from the DOM").
  // networkidle + waiting for the button's own stable visibility avoids
  // that race without guessing at a fixed delay.
  async function openWorkspaceSwitcher(page: import('@playwright/test').Page) {
    await page.waitForLoadState('networkidle');
    const button = page.getByLabel(/workspace context/i);
    await button.waitFor({ state: 'visible' });
    await button.click();
  }

  async function switchTo(page: import('@playwright/test').Page, clientId: string | null) {
    if (clientId) {
      await page.evaluate((id) => {
        window.history.pushState({}, '', `/dashboard?client=${id}`);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }, clientId);
    }
    // The actual trigger path is the header dropdown; but since its exact
    // click sequence depends on canOpenClients/isFullAccess state that
    // varies per logged-in account, the more robust way to drive a switch
    // in this spec is the header's workspace-context control itself:
    await openWorkspaceSwitcher(page);
  }

  test('Syntra Grid -> client: overlay shows logo + "Switching to" + name, URL gets ?client=', async ({ page }) => {
    await switchTo(page, null);
    // AdminHeader.tsx's ContextMenuItem renders the client's label
    // (displayName) as plain text in a plain <button> — no menu/menuitem
    // role on this particular dropdown (unlike the separate department
    // switcher below), so a text locator is the correct, not a fallback,
    // way to select it.
    await page.getByText(clientA.displayName, { exact: false }).first().click();

    // Current markup (ClientSwitchOverlay.tsx, redesigned after this spec
    // was first written): root class `.cso`, label/name as separate
    // elements rather than one sentence.
    const overlay = page.locator('.cso');
    await expect(overlay).toBeVisible({ timeout: 1000 });
    await expect(overlay).toContainText('Switching to');
    await expect(overlay).toContainText(clientA.displayName);
    await expect(overlay).toBeHidden({ timeout: 3000 });

    await expect(page).toHaveURL(new RegExp(`client=${clientA.id}`));
  });

  test('client A -> client B: no stale client-A content flashes', async ({ page }) => {
    await page.goto(`/dashboard?client=${clientA.id}&tab=client_health`);
    await openWorkspaceSwitcher(page);
    await page.getByText(clientB.displayName, { exact: false }).first().click();

    // Sample repeatedly across the transition window (current total
    // ENTER+HOLD+EXIT ~= 460ms) for any lingering client-A-only marker —
    // none should ever appear once the switch has started.
    for (let i = 0; i < 15; i += 1) {
      await expect(page.getByText(clientA.displayName)).toHaveCount(0);
      await page.waitForTimeout(100);
    }

    await expect(page).toHaveURL(new RegExp(`client=${clientB.id}`));
  });

  test('client -> Syntra Grid: overlay says "Returning to" / "Syntra Grid", ?client= removed', async ({ page }) => {
    await page.goto(`/dashboard?client=${clientB.id}`);
    await openWorkspaceSwitcher(page);
    await page.getByText('Syntra Grid', { exact: false }).first().click();

    const overlay = page.locator('.cso').filter({ hasText: 'Returning to' });
    await expect(overlay).toBeVisible({ timeout: 1000 });
    await expect(overlay).toContainText('Syntra Grid');
    await expect(overlay).toBeHidden({ timeout: 3000 });

    await expect(page).not.toHaveURL(/client=/);

    const storedContext = await page.evaluate(() => window.localStorage.getItem('syntragrid.workspace-context'));
    expect(storedContext).toBe('company');
  });

  test('rapid switching across three clients lands on the last one clicked, no errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    for (const target of [clientA, clientB, clientNoLogo]) {
      await openWorkspaceSwitcher(page);
      await page.getByText(target.displayName, { exact: false }).first().click({ timeout: 2000 }).catch(() => {});
    }

    await page.waitForTimeout(700); // settle past the overlay's current ~460ms total duration

    await expect(page).toHaveURL(new RegExp(`client=${clientNoLogo.id}`));
    expect(consoleErrors.filter((text) => !text.includes('favicon'))).toHaveLength(0);
    await expect(page.getByText(/could not be loaded|something went wrong/i)).toHaveCount(0);
  });

  test('refreshing a client-specific URL never shows the switch overlay', async ({ page }) => {
    await page.goto(`/dashboard?client=${clientA.id}`);
    await page.waitForLoadState('networkidle');

    // Hydration sets selectedClientId directly (not via selectClient()), so
    // lastSwitch is never populated on load — the overlay must stay absent
    // for the entirety of a generous observation window.
    await expect(page.locator('.cso')).toHaveCount(0);
    await page.waitForTimeout(1000);
    await expect(page.locator('.cso')).toHaveCount(0);
  });

  test('switching department while a client is selected leaves the client selection untouched', async ({ page }) => {
    await page.goto(`/dashboard?client=${clientA.id}`);

    const workspaceSwitcher = page.getByLabel(/switch workspace/i);
    if (await workspaceSwitcher.count() === 0) {
      test.skip(true, 'No department/workspace switcher visible for this account — nothing to assert.');
    }

    await workspaceSwitcher.click();
    await page.getByRole('menuitem').first().click();

    await expect(page).toHaveURL(new RegExp(`client=${clientA.id}`));
  });

  test('missing-logo client shows ClientMark initials fallback, not a broken image', async ({ page }) => {
    await page.goto('/dashboard');
    await openWorkspaceSwitcher(page);
    await page.getByText(clientNoLogo.displayName, { exact: false }).first().click();

    const overlay = page.locator('.cso');
    await expect(overlay).toBeVisible({ timeout: 1000 });
    // ClientMark's fallback renders initials text, not an <img> — assert no
    // <img> is present inside the "to" mark (the destination, which is the
    // logoless fixture here) while the overlay is up.
    await expect(overlay.locator('.mark.to img')).toHaveCount(0);
  });

  test('reduced motion: overlay still announces via aria-live, but renders without transition', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/dashboard');
    await openWorkspaceSwitcher(page);
    await page.getByText(clientA.displayName, { exact: false }).first().click();

    const overlay = page.locator('.cso');
    await expect(overlay).toBeVisible({ timeout: 1000 });
    await expect(overlay).toHaveAttribute('aria-live', 'polite');

    const transition = await overlay.evaluate((element) => getComputedStyle(element).transitionDuration);
    expect(transition === '0s' || transition === '').toBeTruthy();
  });
});
