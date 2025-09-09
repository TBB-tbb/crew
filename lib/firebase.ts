// /lib/firebase.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";
// （必要なら）import { getAnalytics, isSupported } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  // 無くてもOK。用意していれば勝手に使われます
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Next.jsで再初期化を避けるためのガード
function createFirebaseApp(config = firebaseConfig): FirebaseApp {
  if (!getApps().length) {
    return initializeApp(config);
  }
  return getApp();
}

const app = createFirebaseApp();

export const db: Firestore = getFirestore(app);
export const auth: Auth = getAuth(app);
// （必要ならAnalytics。クライアント & サポート時のみ）
// export const analyticsPromise = (async () => {
//   if (typeof window !== 'undefined' && (await isSupported())) {
//     const { getAnalytics } = await import('firebase/analytics');
//    return getAnalytics(app);
//   }
//   return null;
// })();

export { app };
