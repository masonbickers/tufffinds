// src/lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getStorage } from "firebase/storage";

/**
 * Prefer ENV vars in production. You can keep these hardcoded while testing,
 * but add them to Vercel later as NEXT_PUBLIC_* (see notes below).
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "AIzaSyCUGNekU4edYGDtl7SXjBJ7-skPVMOuyUo",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "tufffinds.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "tufffinds",
  // IMPORTANT: the storageBucket should be "<project-id>.appspot.com"
  // not "firebasestorage.app"
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "tufffinds.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "71851233987",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "1:71851233987:web:3caa05caa5ddbbe9b8c876",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? "G-CFY7MP8Q1L",
};

// Avoid re-initialising during dev HMR
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

/**
 * Analytics only works in the browser. Call this inside client components if needed.
 * Example: `initAnalytics().then(() => {})`
 */
export async function initAnalytics() {
  if (typeof window === "undefined") return;
  try {
    const { getAnalytics, isSupported } = await import("firebase/analytics");
    if (await isSupported()) getAnalytics(app);
  } catch {
    // ignore if unsupported (SSR / older browsers)
  }
}
