// e2e/incidents-technical-view.spec.ts
//
// Technology Operations Phase 1 — technical incidents view. Verifies this
// is a READ-ONLY filter over the EXISTING Incident model: an incident
// opened via Client Health's own monitoring flow (Check Now against a
// failing fixture, past the consecutive-failure threshold) shows up,
// same id and same lifecycle, in the new Incidents tab — never a second,
// duplicated record.

import { test, expect } from '@playwright/test';
import {
  seedFixtureClient,
  seedFixtureEndpoint,
  teardownFixtures,
  loginAsTestAdmin,
  FIXTURE_FAILING_URL,
  type FixtureClient,
} from './fixtures';

test.describe('Technology Operations — technical incidents view', () => {
  let client: FixtureClient;

  test.beforeEach(async ({ page }) => {
    client = await seedFixtureClient('incidents-technical-view-client');
    await loginAsTestAdmin(page);
  });

  test.afterEach(async () => {
    await teardownFixtures();
  });

  test('an incident opened via Client Health monitoring shows up in the Incidents tab with the same lifecycle', async ({ page }) => {
    const endpoint = await seedFixtureEndpoint(client.id, FIXTURE_FAILING_URL);

    // Open it via Client Health's existing detail panel and run Check Now
    // twice (below, then at, the consecutive-failure threshold) — the same
    // path e2e/client-health-monitoring.spec.ts already verifies opens an
    // incident. Not re-testing that mechanism here, just that its result
    // is visible from this new tab too.
    await page.goto('/dashboard?tab=client_health');
    await page.waitForLoadState('networkidle');
    await page.getByText(client.name, { exact: false }).first().click();

    const row = page.locator('li', { hasText: endpoint.label });
    const checkNow = row.getByRole('button', { name: /check/i });
    await checkNow.click();
    await expect(row.getByText(/offline|degraded|500/i)).toBeVisible({ timeout: 10_000 });

    // A 31s wait against the 30s per-endpoint floor left only ~1s margin —
    // too thin against real clock/latency variance (confirmed: the second
    // click was rejected with "checked less than 30 seconds ago" even
    // after a genuine 31s real-world wait). 40s gives real headroom.
    await page.waitForTimeout(40_000);
    await checkNow.click();
    await expect(page.getByText(/unreachable|degraded/i)).toBeVisible({ timeout: 10_000 });

    // Close the Client Health detail panel and switch to the new Incidents
    // tab — same incident, no re-creation.
    await page.getByRole('button', { name: /^close$/i }).click();
    await page.goto('/dashboard?tab=incidents');
    await page.waitForLoadState('networkidle');

    // AdminShell.tsx renders a separate desktop AND mobile <main> tree
    // simultaneously (only one actually visible via responsive CSS at any
    // given viewport) — an unscoped page-wide locator matches both DOM
    // copies even though only one is shown. #admin-shell-scroll-area is
    // specifically inside the desktop tree, the one visible at this
    // config's 1440px viewport.
    const content = page.locator('#admin-shell-scroll-area');

    const incidentRow = content.getByText(new RegExp(`${endpoint.label} is unreachable`, 'i'));
    await expect(incidentRow).toBeVisible();

    // Switch the filter to "All" first — IncidentsTab.tsx reloads under
    // whatever filter is active after resolving, and the default "Active
    // only" filter would otherwise make the row disappear the instant it's
    // resolved, before this test could assert on it.
    await content.getByLabel('Filter by resolved status').selectOption({ label: 'All' });

    // Resolving from THIS tab must update the one shared Incident row —
    // acknowledgeIncidentApi/resolveIncidentApi are re-exported straight
    // from clientHealthApi.ts, not reimplemented.
    const incidentLi = content.locator('li', { hasText: `${endpoint.label} is unreachable` });
    await incidentLi.getByRole('button', { name: /^resolve$/i }).click();
    await expect(incidentLi.getByText(/^resolved$/i)).toBeVisible({ timeout: 5000 });
  });
});
