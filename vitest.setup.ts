import { vi } from "vitest";

// lib/auth/current-admin.ts transitively imports next/headers (reading
// the session cookie), which only resolves inside Next's own runtime.
// The Campaigns test suite only exercises pure business logic — it never
// actually calls getCurrentIdentity/requirePermission/hasPermission — so
// this stub exists purely to satisfy the import graph. AuthorisationError
// is real (several tests assert on it being thrown).
vi.mock("@/lib/auth/current-admin", () => {
  class AuthorisationError extends Error {}
  class AuthenticationError extends Error {}
  return {
    AuthorisationError,
    AuthenticationError,
    getCurrentIdentity: vi.fn(),
    hasPermission: vi.fn(),
    requirePermission: vi.fn(),
  };
});

// lib/prisma.ts throws at import time if DATABASE_URL is unset, and
// server.ts/content.ts/planner.ts/analytics.ts all import it even though
// these tests never call Prisma.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
