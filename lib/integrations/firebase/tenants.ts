// lib/integrations/firebase/tenants.ts
//
// Resolves a Firebase Admin app per client, on demand, from env-var
// credentials. Replaces the single hardcoded app in client.ts.
//
// Two things this has to get right:
//   1. initializeApp throws on a duplicate name, and Next hot-reloads modules
//      on every save in dev — so apps are cached on globalThis, not module
//      scope.
//   2. Credentials are read lazily. A client with no env vars yet must not
//      break the import of this file for every other client.

import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

import { getFirebaseCredentials } from './credentials';

type Tenant = { app: App; db: Firestore; auth: Auth };

const globalCache = globalThis as typeof globalThis & {
  __syntraFirebaseTenants?: Map<string, Tenant>;
};

const tenants: Map<string, Tenant> = (globalCache.__syntraFirebaseTenants ??=
  new Map());

/**
 * Firebase handles for one client. Throws MissingCredentialsError when the
 * env vars are not set — callers should catch and render the setup prompt.
 */
export function getFirebaseTenant(slug: string): Tenant {
  const cached = tenants.get(slug);
  if (cached) return cached;

  const credentials = getFirebaseCredentials(slug);
  const appName = `client:${slug}`;

  const existing = getApps().find((app) => app.name === appName);

  const app =
    existing ??
    initializeApp(
      {
        credential: cert({
          projectId: credentials.projectId,
          clientEmail: credentials.clientEmail,
          privateKey: credentials.privateKey,
        }),
        storageBucket: credentials.storageBucket,
      },
      appName,
    );

  const tenant: Tenant = { app, db: getFirestore(app), auth: getAuth(app) };
  tenants.set(slug, tenant);

  return tenant;
}

export function getTenantDb(slug: string): Firestore {
  return getFirebaseTenant(slug).db;
}

export function getTenantAuth(slug: string): Auth {
  return getFirebaseTenant(slug).auth;
}

/**
 * Cheap round trip to confirm the credentials actually work. Use this behind
 * a "Test connection" button rather than waiting for a page to fail.
 */
export async function testFirebaseConnection(
  slug: string,
): Promise<{ ok: true; projectId: string } | { ok: false; error: string }> {
  try {
    const { db, app } = getFirebaseTenant(slug);
    await db.listCollections();
    return { ok: true, projectId: app.options.projectId ?? 'unknown' };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown connection error.',
    };
  }
}