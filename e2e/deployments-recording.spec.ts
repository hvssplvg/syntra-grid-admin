// e2e/deployments-recording.spec.ts
//
// Technology Operations Phase 1 — Deployment management. This is the
// FIRST-EVER real write path for the Deployment model (confirmed this
// session: zero write call sites existed anywhere in the app before it).
// Verifies recording works end to end, and — per the task's explicit
// "do not trigger real deployments from this dashboard" — that no UI
// control anywhere claims to actually deploy anything.

import { test, expect } from '@playwright/test';
import {
  seedFixtureClient,
  seedFixtureProject,
  teardownFixtures,
  loginAsTestAdmin,
  type FixtureClient,
  type FixtureProject,
} from './fixtures';

test.describe('Technology Operations — Deployment management', () => {
  let client: FixtureClient;
  let project: FixtureProject;

  test.beforeEach(async ({ page }) => {
    client = await seedFixtureClient('deployments-recording-client');
    project = await seedFixtureProject(client.id);
    await loginAsTestAdmin(page);
  });

  test.afterEach(async () => {
    await teardownFixtures();
  });

  test('records a deployment (never triggers one) and it appears in the list', async ({ page }) => {
    await page.goto('/dashboard?tab=deployments');
    await page.waitForLoadState('networkidle');

    // Nothing on this page claims to actually deploy/ship/release/push —
    // only ever to record that one already happened.
    await expect(page.getByRole('button', { name: /^(deploy|ship|release|push)( now)?$/i })).toHaveCount(0);

    await page.getByRole('button', { name: /record deployment/i }).click();
    // Not getByLabel('Client')/getByLabel('Project') — the sidebar's
    // "Client Success" department button's accessible name contains
    // "Client" as a substring too, making those ambiguous. The dialog's
    // own ids are unambiguous.
    await page.locator('#deployment-client').selectOption({ label: client.displayName });
    await page.waitForLoadState('networkidle'); // let the reactive project fetch finish
    await page.locator('#deployment-project').selectOption({ label: project.name });
    await page.locator('#deployment-environment').fill('production');
    await page.locator('#deployment-status').selectOption('SUCCESS');
    await page.locator('#deployment-branch').fill('main');
    await page.locator('#deployment-commit').fill('abc1234');
    // Scoped to the dialog — the page's own "Record Deployment" trigger
    // button and the dialog's "Record deployment" submit button only
    // differ in letter case, which a case-insensitive regex collapses.
    const recordDialog = page.getByRole('dialog', { name: /record a deployment/i });
    await recordDialog.getByRole('button', { name: /^record deployment$/i }).click();

    await expect(recordDialog).toHaveCount(0);
    await expect(page.getByText(project.name, { exact: false }).first()).toBeVisible();
    await expect(page.getByText('abc1234', { exact: false })).toBeVisible();
  });

  test('a FAILED deployment opens exactly one technical incident, visible from the Incidents tab', async ({ page }) => {
    await page.goto('/dashboard?tab=deployments');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /record deployment/i }).click();
    await page.locator('#deployment-client').selectOption({ label: client.displayName });
    await page.waitForLoadState('networkidle'); // let the reactive project fetch finish
    await page.locator('#deployment-project').selectOption({ label: project.name });
    await page.locator('#deployment-status').selectOption('FAILED');
    const recordDialog = page.getByRole('dialog', { name: /record a deployment/i });
    await recordDialog.getByRole('button', { name: /^record deployment$/i }).click();
    await expect(recordDialog).toHaveCount(0);

    await page.goto('/dashboard?tab=incidents');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/deployment failed/i).first()).toBeVisible();
  });
});
