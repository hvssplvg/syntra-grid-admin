// src/lib/firebase.ts
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

/*
  Config reads from env with the literal values as a fallback, so this keeps
  working if .env.local isn't set up yet. Add these to .env.local and to your
  Vercel project settings:

    NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyA929MMjwHV51vGEVE5Q5qkpkbRpefA0B0
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=syntra-3a544.firebaseapp.com
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=syntra-3a544
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=syntra-3a544.firebasestorage.app
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=631365540890
    NEXT_PUBLIC_FIREBASE_APP_ID=1:631365540890:web:f85fd8983c794b1f6bc5a3
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-1ZZ8W4VM53
*/
const firebaseConfig = {
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ??
    "AIzaSyA929MMjwHV51vGEVE5Q5qkpkbRpefA0B0",
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ??
    "syntra-3a544.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "syntra-3a544",
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??
    "syntra-3a544.firebasestorage.app",
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "631365540890",
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ??
    "1:631365540890:web:f85fd8983c794b1f6bc5a3",
  measurementId:
    process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? "G-1ZZ8W4VM53",
};

/* Next re-evaluates modules on hot reload and again on the server, so
   initialising unconditionally throws "Firebase App named '[DEFAULT]'
   already exists". Reuse the instance if one is already up. */
const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const db: Firestore = getFirestore(app);
export const auth: Auth = getAuth(app);
export const storage: FirebaseStorage = getStorage(app);

/* Analytics touches window, so it can never run during SSR. Call this from
   inside a useEffect in a client component if you want it:

     useEffect(() => { void initAnalytics(); }, []);
*/
export async function initAnalytics() {
  if (typeof window === "undefined") return null;

  const { getAnalytics, isSupported } = await import("firebase/analytics");
  if (!(await isSupported())) return null;

  return getAnalytics(app);
}

export { app };
export default app;