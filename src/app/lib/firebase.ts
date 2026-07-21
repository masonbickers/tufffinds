import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getStorage } from "firebase/storage";

const requiredFirebaseEnv = {
  NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const missingFirebaseEnv = Object.entries(requiredFirebaseEnv)
  .filter(([, value]) => !value)
  .map(([name]) => name);

if (typeof window !== "undefined" && missingFirebaseEnv.length > 0) {
  throw new Error(
    `Missing required Firebase environment variables: ${missingFirebaseEnv.join(", ")}`
  );
}

// Client components are evaluated while Next.js prerenders. These inert values
// let that server-only pass complete without weakening the browser-side check.
const serverPlaceholder = typeof window === "undefined";

const firebaseConfig = {
  apiKey:
    requiredFirebaseEnv.NEXT_PUBLIC_FIREBASE_API_KEY ??
    (serverPlaceholder ? `AIzaSy${"0".repeat(33)}` : undefined),
  authDomain:
    requiredFirebaseEnv.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ??
    (serverPlaceholder ? "build.invalid" : undefined),
  projectId:
    requiredFirebaseEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??
    (serverPlaceholder ? "build-placeholder" : undefined),
  storageBucket:
    requiredFirebaseEnv.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??
    (serverPlaceholder ? "build.invalid" : undefined),
  messagingSenderId:
    requiredFirebaseEnv.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ??
    (serverPlaceholder ? "000000000000" : undefined),
  appId:
    requiredFirebaseEnv.NEXT_PUBLIC_FIREBASE_APP_ID ??
    (serverPlaceholder ? "1:000000000000:web:0000000000000000000000" : undefined),
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export async function initAnalytics() {
  if (typeof window === "undefined") return;
  try {
    const { getAnalytics, isSupported } = await import("firebase/analytics");
    if (await isSupported()) getAnalytics(app);
  } catch {
    // Analytics is optional and unsupported in some browser/SSR environments.
  }
}
