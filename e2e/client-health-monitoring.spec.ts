// e2e/client-health-monitoring.spec.ts
//
// Part 2 — Client Health reliability pass (manual "Check Now", monitoring
// history, consecutive-failure incident threshold). See the approved plan
// at /Users/hvss/.claude/plans/twinkling-mapping-quasar.md, sections 2-4.
//
// WRITTEN AGAINST THE PLAN, NOT AGAINST SHIPPED CODE: as of when this file
// was written, app/components/admin/tabs/ClientHealthTab.tsx has no "Check
// Now" button and no history panel yet — only the pre-existing endpoint
// list (name/URL/latest status/"Awaiting first check") and the "Add a
// monitored endpoint" dialog exist. That other work is being done
// separately. Selectors below are written as resiliently as possible
// (role/text-based) against the *planned* UI so they need minimal rework
// once it ships, but they WILL fail until the Check Now button and history
// panel actually exist. Do not treat a failure here as a regression until
// that work has landed — re-check the actual markup first.
//
// Fixtures: see e2e/fixtures.ts. httpstat.us/200 and httpstat.us/500 are
// public, intended-for-testing endpoints — never a real client's
// production URL.

import { test, expect } from '@playwright/test';
import {
  seedFixtureClient,
  seedFixtureEndpoint,
  teardownFixtures,
  loginAsTestAdmin,
  FIXTURE_HEALTHY_URL,
  FIXTURE_FAILING_URL,
  type FixtureClient,
} from './fixtures';

test.describe('Client Health monitoring reliability', () => {
  let client: FixtureClient;

  test.beforeEach(async ({ page }) => {
    client = await seedFixtureClient('zzz-e2e-fixture-monitoring-client');
    await loginAsTestAdmin(page);
  });

  test.afterEach(async () => {
    await teardownFixtures();
  });

  async function openDetail(page: import('@playwright/test').Page) {
    await page.goto('/dashboard?tab=client_health');
    await page.getByText(client.name, { exact: false }).first().click();
  }

  test('adding an endpoint shows the "Awaiting first check" info state, never Healthy', async ({ page }) => {
    await openDetail(page);

    await page.getByRole('button', { name: /^add$/i }).click();
    await page.getByLabel(/label/i).fill('zzz-e2e-fixture-endpoint');
    await page.getByLabel(/url/i).fill(FIXTURE_HEALTHY_URL);
    await page.getByRole('button', { name: /add endpoint/i }).click();

    // Scoped to the detail panel (role="dialog", aria-label="Client health
    // detail") — the page-wide list has other real clients already marked
    // Healthy, so a page-wide check would be a false positive on this
    // fixture's own, still-pending endpoint.
    const detail = page.getByRole('dialog', { name: /client health detail/i });

    // Two places legitimately say this within the detail panel: the "why
    // this status" reason ("1 endpoint awaiting first check.") and the
    // per-row status line ("Awaiting first check · every Nmin") — .first()
    // is fine, both existing is itself part of what this test confirms.
    await expect(detail.getByText('Awaiting first check').first()).toBeVisible({ timeout: 5000 });
    await expect(detail.getByText(/^healthy$/i)).toHaveCount(0);
  });

  test('Check Now against a healthy fixture flips status to Healthy and records one history row', async ({ page }) => {
    const endpoint = await seedFixtureEndpoint(client.id, FIXTURE_HEALTHY_URL);
    await openDetail(page);

    const row = page.locator('li', { hasText: endpoint.label });
    // Not /check now/i: the button's aria-label is "Check {label} now"
    // (disambiguates multiple endpoint rows for screen readers), which
    // overrides its visible text as the accessible name, so the full
    // phrase "check now" is never contiguous in it. /check/i still
    // uniquely matches within this row (History/Stop-monitoring don't).
    await row.getByRole('button', { name: /check/i }).click();

    // Two elements legitimately say "healthy" after a successful Check
    // Now: the per-row status line AND the transient
    // "HEALTHY · <ms>ms" success message — .first() is fine.
    await expect(row.getByText(/healthy/i).first()).toBeVisible({ timeout: 10_000 });

    await row.getByRole('button', { name: /history/i }).click();
    // EndpointHistoryPanel.tsx's history table is a real <table> — <tr>
    // carries an implicit ARIA role="row" on BOTH the <thead> header row
    // and each <tbody> data row, so a bare getByRole('row') over-counts
    // by one (the header). Scope to <tbody> rows specifically.
    // Scoped to this endpoint's own row — the main client list is also a
    // <table>, so an unscoped 'tbody tr' matches its rows too.
    const historyRows = row.locator('tbody tr');
    await expect(historyRows).toHaveCount(1, { timeout: 5000 });
    await expect(historyRows.first()).toContainText(/healthy/i);
    await expect(historyRows.first()).toContainText('200');
  });

  test('Check Now against a failing fixture twice: first stays below threshold, second opens an incident', async ({ page }) => {
    const endpoint = await seedFixtureEndpoint(client.id, FIXTURE_FAILING_URL);
    await openDetail(page);

    const row = page.locator('li', { hasText: endpoint.label });
    const checkNow = row.getByRole('button', { name: /check/i });

    await checkNow.click();
    await expect(row.getByText(/offline|degraded|500/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/unreachable|degraded/i)).toHaveCount(0);

    // Respect the Check Now rate limit (per-endpoint minimum gap, ~30s per
    // the plan) — wait rather than hammering it.
    await page.waitForTimeout(31_000);
    await checkNow.click();
    await expect(page.getByText(/unreachable|degraded/i)).toBeVisible({ timeout: 10_000 });
  });

  test('monitoring history panel renders 24h/7d/30d ranges and an insufficient-data state for a fresh endpoint', async ({ page }) => {
    const endpoint = await seedFixtureEndpoint(client.id, FIXTURE_HEALTHY_URL);
    await openDetail(page);

    const row = page.locator('li', { hasText: endpoint.label });
    await row.getByRole('button', { name: /history/i }).click();

    for (const range of [/24h/i, /7d/i, /30d/i]) {
      await page.getByRole('button', { name: range }).click();
    }

    // This endpoint has never been checked (no Check Now call in this
    // test) — EndpointHistoryPanel.tsx's totalChecks===0 branch renders
    // "No checks have been recorded yet", a distinct, more accurate
    // message than its totalChecks>0-but-sparse "Not enough history yet"
    // branch. Zero checks is genuinely the right case to exercise here.
    await expect(page.getByText(/no checks have been recorded yet/i)).toBeVisible();
  });
});
