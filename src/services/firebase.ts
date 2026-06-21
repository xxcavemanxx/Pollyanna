import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Standard Firebase Configuration loaded from Vite Env
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Check if we have a valid configuration (e.g. VITE_FIREBASE_PROJECT_ID is present)
const isFirebaseEnabled = !!firebaseConfig.projectId && firebaseConfig.projectId !== "YOUR_PROJECT_ID";

let app;
let db: any = null;
let auth: any = null;

if (isFirebaseEnabled) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(app);
    auth = getAuth(app);
    console.log("🔥 Firebase initialized successfully!");
  } catch (error) {
    console.error("⚠️ Error initializing Firebase. Falling back to local mode:", error);
  }
} else {
  console.warn("🔔 Firebase environment variables not detected or set to placeholder. Running in premium Local Simulation & Offline Mode.");
}

export { db, auth, isFirebaseEnabled };
