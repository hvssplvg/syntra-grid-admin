// lib/auth/server.ts

import { createNeonAuth } from '@neondatabase/auth/next/server';

const baseUrl = process.env.NEON_AUTH_BASE_URL;
const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET;

if (!baseUrl) {
  throw new Error('NEON_AUTH_BASE_URL is not defined.');
}

if (!cookieSecret) {
  throw new Error('NEON_AUTH_COOKIE_SECRET is not defined.');
}

export const auth = createNeonAuth({
  baseUrl,
  cookies: {
    secret: cookieSecret,
    // @neondatabase/auth 0.4.x defaults this to "strict" (its own docs:
    // "previous hard-coded behavior" was "lax"). Strict means the
    // session cookie is withheld on a top-level cross-site navigation —
    // exactly what happens when an external OAuth provider (X, LinkedIn,
    // Monzo) redirects the browser back to us. Explicitly set back to
    // "lax" (the long-standing, still-secure standard for session
    // cookies in any app with redirect-based external integrations) so
    // those connect flows don't silently appear to sign the admin out.
    sameSite: 'lax',
  },
});