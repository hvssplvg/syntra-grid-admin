import {
  cert,
  getApps,
  initializeApp,
  type App,
} from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is not defined.`);
  }

  return value;
}

function createEsteemFirebaseApp(): App {
  const existingApp = getApps().find(
    (app) => app.name === 'esteem-learning-centre'
  );

  if (existingApp) {
    return existingApp;
  }

  return initializeApp(
    {
      credential: cert({
        projectId: getRequiredEnv('ESTEEM_FIREBASE_PROJECT_ID'),
        clientEmail: getRequiredEnv('ESTEEM_FIREBASE_CLIENT_EMAIL'),
        privateKey: getRequiredEnv(
          'ESTEEM_FIREBASE_PRIVATE_KEY'
        ).replace(/\\n/g, '\n'),
      }),
      storageBucket: process.env.ESTEEM_FIREBASE_STORAGE_BUCKET,
    },
    'esteem-learning-centre'
  );
}

export const esteemFirebaseApp = createEsteemFirebaseApp();

export const esteemFirestore = getFirestore(esteemFirebaseApp);

export const esteemFirebaseAuth = getAuth(esteemFirebaseApp);