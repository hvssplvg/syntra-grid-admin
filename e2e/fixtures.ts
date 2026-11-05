// e2e/fixtures.ts
//
// Shared helpers for the Playwright specs in this directory.
//
// IMPORTANT — there is no separate test database. `.env` and `.env.local`
// both resolve to the same Neon Postgres instance (`ep-old-silence-abo8z8ft`,
// db `neondb`) that local `next dev` already uses. Every fixture this file
// creates is prefixed FIXTURE_PREFIX ("zzz-e2e-fixture-") so it is instantly
// greppable/sortable away from real data, and `teardownFixtures()` deletes
// every Client row under that prefix — Incident/MonitoredEndpoint/HealthCheck
// all cascade-delete from Client (confirmed in prisma/schema.prisma: Client's
// relations to MonitoredEndpoint and Incident are `onDelete: Cascade`, and
// MonitoredEndpoint's relations to HealthCheck and Incident are too), so
// deleting the fixture Client rows is sufficient cleanup on its own.
//
// Actual Prisma access happens in a separate `tsx` child process
// (e2e/prismaFixtureCli.ts), not via a direct import here — see that
// file's doc comment for why (Playwright's CJS test transform can't load
// the generated Prisma client's `import.meta` syntax).
//
// Never point a fixture MonitoredEndpoint at a real client's production URL.
// httpstat.us is a public, intended-for-testing HTTP status echo service —
// safe to hit repeatedly, not real infrastructure.

import { execFileSync } from "node:child_process";
import path from "node:path";
import type { Page } from "@playwright/test";

export const FIXTURE_PREFIX = "zzz-e2e-fixture-";

// httpstat.us (originally used here) is NOT reachable from this sandboxed
// environment (confirmed: curl gets "empty reply from server" / exit 52,
// while general internet access otherwise works fine) — every check
// against it resolved as OFFLINE regardless of the requested status code,
// which silently broke the "healthy fixture" scenarios. httpbin.org's
// equivalent /status/<code> endpoint is confirmed reachable and resolves
// to public (non-private) addresses, so safeFetch.ts's SSRF guard allows
// it normally.
export const FIXTURE_HEALTHY_URL = "https://httpbin.org/status/200";
export const FIXTURE_FAILING_URL = "https://httpbin.org/status/500";

const CLI_PATH = path.resolve(__dirname, "prismaFixtureCli.ts");

function runCli(command: string, args: Record<string, unknown>): unknown {
  const output = execFileSync("npx", ["tsx", CLI_PATH, command, JSON.stringify(args)], {
    cwd: path.resolve(__dirname, ".."),
    encoding: "utf8",
  });
  return JSON.parse(output);
}

function uniqueSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export type FixtureClient = { id: string; name: string; slug: string; displayName: string };

/**
 * Seeds a fixture Client via the prismaFixtureCli child process rather than
 * through the admin UI, since client creation isn't the thing under test
 * here.
 *
 * @param label A short human label for the fixture — callers pass "Meldex
 *   Industries" / "HomeWise" etc. to echo the task's example copy, but
 *   EVERY field actually written (name, slug, AND displayName) is prefixed.
 *   This matters: a real, pre-existing production client in this database
 *   is already named plain "HomeWise" (confirmed while debugging this file)
 *   — AdminHeader.tsx's dropdown renders `displayName`, so an unprefixed
 *   fixture displayName collides with real UI text and a test can end up
 *   clicking/asserting against the wrong (real) client. Prefixing
 *   displayName too, not just name/slug, is what actually prevents that.
 * @param logoUrl Pass a real (reachable) image URL to exercise the normal
 *   ClientMark path, or `null` to exercise its initials-fallback path. Must
 *   be on an allow-listed next/image remote host (res.cloudinary.com per
 *   next.config.ts) — any other host throws an uncaught render error.
 */
export async function seedFixtureClient(label: string, logoUrl: string | null = null): Promise<FixtureClient> {
  const suffix = uniqueSuffix();
  const displayName = `${FIXTURE_PREFIX}${label}`;
  const created = runCli("seedClient", {
    name: `${FIXTURE_PREFIX}${label}`,
    slug: `${FIXTURE_PREFIX}${suffix}`,
    displayName,
    logoUrl,
  }) as { id: string; name: string; slug: string };
  return { ...created, displayName };
}

export type FixtureEndpoint = { id: string; label: string };

export async function seedFixtureEndpoint(
  clientId: string,
  url: string,
  label = `${FIXTURE_PREFIX}endpoint-${uniqueSuffix()}`,
): Promise<FixtureEndpoint> {
  return runCli("seedEndpoint", { clientId, url, label }) as FixtureEndpoint;
}

export type FixtureProject = { id: string; name: string };

export async function seedFixtureProject(clientId: string, label = `${FIXTURE_PREFIX}project-${uniqueSuffix()}`): Promise<FixtureProject> {
  return runCli("seedProject", { clientId, name: label, slug: `${FIXTURE_PREFIX}${uniqueSuffix()}` }) as FixtureProject;
}

export type FixtureSystem = { id: string; name: string; clientId: string | null };

/** clientId: null seeds a Syntra-Grid-internal fixture system — exercise
 *  that path deliberately in at least one test, not just the common
 *  client-owned case. */
export async function seedFixtureSystem(
  clientId: string | null,
  overrides: { projectId?: string; systemType?: string; name?: string } = {},
): Promise<FixtureSystem> {
  return runCli("seedSystem", {
    clientId,
    projectId: overrides.projectId,
    systemType: overrides.systemType,
    name: overrides.name ?? `${FIXTURE_PREFIX}system-${uniqueSuffix()}`,
  }) as FixtureSystem;
}

export type FixtureDeployment = { id: string; status: string };

export async function seedFixtureDeployment(projectId: string, overrides: { status?: string; environment?: string; branch?: string } = {}): Promise<FixtureDeployment> {
  return runCli("seedDeployment", { projectId, ...overrides }) as FixtureDeployment;
}

/** Hard-deletes every fixture Client AND every fixture ManagedSystem
 *  created by this file (ManagedSystem.client uses onDelete: SetNull, not
 *  Cascade, so it needs its own explicit delete — see
 *  prismaFixtureCli.ts's teardown command). Client deletion itself
 *  cascades to MonitoredEndpoint/HealthCheck/Incident/Project/Deployment —
 *  NOT the same as the admin API's DELETE /api/admin/clients/[id], which
 *  only archives (soft-delete, leaves the row). Call in afterEach/
 *  afterAll, wrapped in try/finally around the test body so a failed
 *  assertion still cleans up. */
export async function teardownFixtures(): Promise<void> {
  runCli("teardown", { prefix: FIXTURE_PREFIX });
}

/**
 * Logs in through the real /login form (app/(auth)/login/LoginForm.tsx) —
 * there's no separate test-auth bypass, so this drives the actual Neon Auth
 * sign-in flow. Requires an already-active, already-linked AdminUser (one
 * that has already completed one-time owner/employee setup) whose
 * credentials are supplied via env vars — never hardcode a real credential
 * here. Throws loudly if they're unset rather than silently skipping auth.
 */
export async function loginAsTestAdmin(page: Page): Promise<void> {
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD must be set to run these specs — ' +
        'they must belong to an existing, active AdminUser with a linked Neon Auth account. ' +
        'Nothing is hardcoded here on purpose.',
    );
  }

  await page.goto('/login');
  await page.getByLabel('Email address').fill(email);
  // Not getByLabel('Password') — the adjacent "Show password" toggle
  // button lives inside the same <label>, so its accessible name also
  // picks up "Password", making that locator ambiguous (strict-mode
  // violation). The input itself is unambiguous by its name attribute.
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();

  // LoginForm.tsx shows the full-screen WelcomeOverlay (app/(auth)/login/WelcomeOverlay.tsx)
  // for up to ~5s + a watchdog before it hard-navigates to /dashboard — wait
  // for the actual destination rather than a fixed sleep.
  await page.waitForURL('**/dashboard**', { timeout: 15_000 });
}
