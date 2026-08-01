import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBdCaSb_3rSMwc2hU7wcasKSA5Jt_1l5x8",
  authDomain: "ryvex-school-system.firebaseapp.com",
  projectId: "ryvex-school-system",
  storageBucket: "ryvex-school-system.firebasestorage.app",
  messagingSenderId: "460289120024",
  appId: "1:460289120024:web:6696d54cf6ef72b0cdf06d",
  measurementId: "G-YT2PNT06GL"
};

export const esteemApp =
  getApps().find(app => app.name === 'esteem') ??
  initializeApp(firebaseConfig, 'esteem');

export const esteemDb = getFirestore(esteemApp);
export const esteemAuth = getAuth(esteemApp);