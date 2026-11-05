// e2e/systems-inventory.spec.ts
//
// Technology Operations Phase 1 — Systems inventory. Verifies the new
// Systems tab is a real, data-backed interface reusing the EXISTING
// Client Health monitoring architecture (MonitoredEndpoint/HealthCheck),
// not a second, parallel one: a linked endpoint's real check result shows
// up in the system's own detail view.
//
// Fixtures: see e2e/fixtures.ts. httpbin.org/status/<code> is a public,
// intended-for-testing endpoint — never a real client's production URL.

import { test, expect } from '@playwright/test';
import {
  seedFixtureClient,
  seedFixtureEndpoint,
  teardownFixtures,
  loginAsTestAdmin,
  FIXTURE_HEALTHY_URL,
  type FixtureClient,
} from './fixtures';

test.describe('Technology Operations — Systems inventory', () => {
  let client: FixtureClient;

  test.beforeEach(async ({ page }) => {
    client = await seedFixtureClient('systems-inventory-client');
    await loginAsTestAdmin(page);
  });

  test.afterEach(async () => {
    await teardownFixtures();
  });

  async function openSystems(page: import('@playwright/test').Page) {
    await page.goto('/dashboard?tab=systems');
    await page.waitForLoadState('networkidle');
  }

  test('creates a client-owned system, links an existing monitored endpoint, and shows its real check result in the detail view', async ({ page }) => {
    const endpoint = await seedFixtureEndpoint(client.id, FIXTURE_HEALTHY_URL);

    await openSystems(page);

    await page.getByRole('button', { name: /new system/i }).click();
    // The "internal system" checkbox defaults to checked when no client is
    // selected in the header (as here) — uncheck it to reveal the client
    // picker before this test's intended client-owned path.
    await page.getByRole('checkbox', { name: /syntra grid internal system/i }).uncheck();
    // Not getByLabel('Client') — both the sidebar's "Client Success"
    // button and the internal-system checkbox's label text ("... not
    // owned by a client") contain "client" as a substring, making that
    // locator ambiguous. The dialog's own id is unambiguous.
    await page.locator('#system-client').selectOption({ label: client.displayName });
    await page.locator('#system-name').fill('zzz-e2e-fixture-marketing-site');
    await page.locator('#system-type').selectOption('WEBSITE');
    await page.getByRole('button', { name: /^add system$/i }).click();

    // Dialog closes and the list reloads with the new row.
    await expect(page.getByRole('dialog', { name: /new system/i })).toHaveCount(0);
    await page.getByText('zzz-e2e-fixture-marketing-site', { exact: false }).first().click();

    const detail = page.getByRole('dialog', { name: /system detail/i });
    await expect(detail).toBeVisible();

    await detail.getByRole('button', { name: /link endpoint/i }).click();
    const linkDialog = page.getByRole('dialog', { name: /link a monitored endpoint/i });
    // Select by value (the endpoint's own id) — selectOption's `label`
    // matcher only accepts an exact string, not a regex, and the fixture
    // endpoint's label alone isn't guaranteed unique against other rows.
    await linkDialog.getByRole('combobox').selectOption(endpoint.id);
    // Scoped to the dialog — its own "Link endpoint" trigger button (in
    // the detail panel behind it) has the identical text as this submit
    // button.
    await linkDialog.getByRole('button', { name: /^link endpoint$/i }).click();

    // The linked endpoint's own (never-checked-yet) state shows honestly —
    // this is the SAME MonitoredEndpoint/HealthCheck data Client Health
    // reads, not a second, independent "is it up" computation.
    await expect(detail.getByText(endpoint.label, { exact: false })).toBeVisible();
    await expect(detail.getByText('Awaiting first check')).toBeVisible();
  });

  test('a Syntra-Grid-internal system (clientId: null) can be created without a fake client row', async ({ page }) => {
    await openSystems(page);

    await page.getByRole('button', { name: /new system/i }).click();
    // The "internal system" checkbox is checked by default when no client
    // is selected in the header — just fill the required fields.
    await page.locator('#system-name').fill('zzz-e2e-fixture-internal-tool');
    await page.locator('#system-type').selectOption('BACKEND_SERVICE');
    await page.getByRole('button', { name: /^add system$/i }).click();

    await expect(page.getByRole('dialog', { name: /new system/i })).toHaveCount(0);
    await expect(page.getByText('zzz-e2e-fixture-internal-tool', { exact: false })).toBeVisible();
    await expect(page.getByText('Syntra Grid (internal)', { exact: false }).first()).toBeVisible();
  });
});
