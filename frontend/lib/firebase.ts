import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize Firestore
export const db = getFirestore(app);

export const auth = getAuth(app);

// Lazy-load Storage, RTDB, Analytics — only when actually needed
export const getStorageLazy = () => import('firebase/storage').then(m => m.getStorage(app));
export const getRtdbLazy = () => import('firebase/database').then(m => m.getDatabase(app));
export const getAnalyticsLazy = () =>
  typeof window !== 'undefined'
    ? import('firebase/analytics').then(m =>
        m.isSupported().then(yes => (yes ? m.getAnalytics(app) : null))
      )
    : Promise.resolve(null);

export default app;
