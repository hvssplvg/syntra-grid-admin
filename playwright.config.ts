import dotenv from 'dotenv';
import { defineConfig, devices } from '@playwright/test';

// The Playwright test process itself (not just the `npm run dev` webServer
// subprocess, which Next.js already env-loads on its own) calls
// e2e/fixtures.ts directly — DATABASE_URL and E2E_ADMIN_* need to be
// present here too. Mirrors prisma.config.ts's own loading.
dotenv.config({ path: '.env.local' });

/**
 * Minimal Playwright config for this repo's Part 1 (workspace-switch
 * transition) and Part 2 (Client Health monitoring) e2e specs.
 *
 * There is no separate test database — `.env`/`.env.local`'s DATABASE_URL
 * both point at the same Neon Postgres instance local dev already uses.
 * Every spec under e2e/ MUST create and tear down its own fixtures via
 * e2e/fixtures.ts (name/label prefix "zzz-e2e-fixture-") rather than
 * assuming any pre-existing row. Running this suite writes to and deletes
 * from that shared database — see e2e/fixtures.ts's own doc comment.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    // AdminHeader.tsx's workspace-context switcher is `hidden ... xl:flex`
    // (Tailwind's xl breakpoint, 1280px) — Desktop Chrome's default 1280px
    // viewport sits exactly on that boundary, which was flaky. Go wider.
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
