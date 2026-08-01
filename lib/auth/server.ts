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
  },
});