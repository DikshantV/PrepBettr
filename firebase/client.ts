import { getFirestore } from "firebase/firestore";
import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Firebase configuration with safe fallback for build time
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_CLIENT_KEY || "mock-key-for-build-time",
    authDomain: "prepbettr.firebaseapp.com",
    projectId: "prepbettr",
    storageBucket: "prepbettr.firebasestorage.app",
    messagingSenderId: "660242808945",
    appId: "1:660242808945:web:4edbaac82ed140f4d05bd0",
    measurementId: "G-LF6KN9F2HY"
};

// Only initialize Firebase if we have a real API key
let app: any = null;
let auth: any = null;
let db: any = null;

try {
  // Check if we have a valid API key (not the build-time mock)
  if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "mock-key-for-build-time") {
    app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    db = getFirestore(app);
  } else {
    console.log('Firebase initialization skipped - using mock configuration for build');
    // Create null instances that won't cause runtime errors
    app = null;
    auth = null;
    db = null;
  }
} catch (error) {
  console.warn('Firebase initialization failed, using fallback configuration:', error);
  app = null;
  auth = null;
  db = null;
}

const googleProvider = new GoogleAuthProvider();

export { auth, db, googleProvider, app };
