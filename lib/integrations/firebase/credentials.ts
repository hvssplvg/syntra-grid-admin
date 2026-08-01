// lib/integrations/credentials.ts
//
// Credentials live in Vercel environment variables, never in the database.
// Variable names are derived from the client's slug, so adding a client means
// adding env vars rather than editing code.
//
//   slug "esteem-learning-centre"  →  prefix "ESTEEM_LEARNING_CENTRE"
//
// Firebase clients need:
//   {PREFIX}_FIREBASE_PROJECT_ID
//   {PREFIX}_FIREBASE_CLIENT_EMAIL
//   {PREFIX}_FIREBASE_PRIVATE_KEY
//   {PREFIX}_FIREBASE_STORAGE_BUCKET   (optional)
//
// Postgres clients need:
//   {PREFIX}_DATABASE_URL
//
// IMPORTANT: env values are read at runtime but Vercel only injects them at
// build time, so adding a variable requires a redeploy before it resolves.

export type DataSource = 'firebase' | 'postgres';

export type FirebaseCredentials = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
  storageBucket?: string;
};

export type PostgresCredentials = {
  connectionString: string;
};

/** What the setup panel shows: which vars exist, which are missing. */
export type CredentialStatus = {
  prefix: string;
  required: { name: string; present: boolean; optional?: boolean }[];
  ready: boolean;
};

/** "esteem-learning-centre" → "ESTEEM_LEARNING_CENTRE" */
export function envPrefix(slug: string): string {
  return slug
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function readEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function requiredVars(slug: string, source: DataSource) {
  const prefix = envPrefix(slug);

  if (source === 'firebase') {
    return [
      { name: `${prefix}_FIREBASE_PROJECT_ID` },
      { name: `${prefix}_FIREBASE_CLIENT_EMAIL` },
      { name: `${prefix}_FIREBASE_PRIVATE_KEY` },
      { name: `${prefix}_FIREBASE_STORAGE_BUCKET`, optional: true },
    ];
  }

  return [{ name: `${prefix}_DATABASE_URL` }];
}

/**
 * Which variables are set for this client. Never returns values — only
 * whether each name resolves — so this is safe to render in the UI.
 */
export function getCredentialStatus(
  slug: string,
  source: DataSource,
): CredentialStatus {
  const prefix = envPrefix(slug);

  const required = requiredVars(slug, source).map((entry) => ({
    ...entry,
    present: readEnv(entry.name) !== null,
  }));

  return {
    prefix,
    required,
    ready: required.every((entry) => entry.optional || entry.present),
  };
}

/** The block a user pastes into Vercel. Placeholders only, no real secrets. */
export function envTemplate(slug: string, source: DataSource): string {
  const prefix = envPrefix(slug);

  if (source === 'firebase') {
    return [
      `${prefix}_FIREBASE_PROJECT_ID=your-project-id`,
      `${prefix}_FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com`,
      `${prefix}_FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nMII...\\n-----END PRIVATE KEY-----\\n"`,
      `${prefix}_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com`,
    ].join('\n');
  }

  return `${prefix}_DATABASE_URL=postgresql://user:password@host:5432/database`;
}

export class MissingCredentialsError extends Error {
  constructor(
    public readonly slug: string,
    public readonly missing: string[],
  ) {
    super(
      `No credentials found for "${slug}". Add ${missing.join(', ')} in Vercel, then redeploy.`,
    );
    this.name = 'MissingCredentialsError';
  }
}

export function getFirebaseCredentials(slug: string): FirebaseCredentials {
  const prefix = envPrefix(slug);

  const projectId = readEnv(`${prefix}_FIREBASE_PROJECT_ID`);
  const clientEmail = readEnv(`${prefix}_FIREBASE_CLIENT_EMAIL`);
  const rawKey = readEnv(`${prefix}_FIREBASE_PRIVATE_KEY`);

  const missing = [
    !projectId && `${prefix}_FIREBASE_PROJECT_ID`,
    !clientEmail && `${prefix}_FIREBASE_CLIENT_EMAIL`,
    !rawKey && `${prefix}_FIREBASE_PRIVATE_KEY`,
  ].filter(Boolean) as string[];

  if (missing.length > 0) throw new MissingCredentialsError(slug, missing);

  return {
    projectId: projectId!,
    clientEmail: clientEmail!,
    // Vercel stores the key with literal backslash-n; surrounding quotes are
    // sometimes kept too. Strip both so the PEM parses.
    privateKey: rawKey!.replace(/^"|"$/g, '').replace(/\\n/g, '\n'),
    storageBucket: readEnv(`${prefix}_FIREBASE_STORAGE_BUCKET`) ?? undefined,
  };
}

export function getPostgresCredentials(slug: string): PostgresCredentials {
  const prefix = envPrefix(slug);
  const connectionString = readEnv(`${prefix}_DATABASE_URL`);

  if (!connectionString) {
    throw new MissingCredentialsError(slug, [`${prefix}_DATABASE_URL`]);
  }

  return { connectionString };
}