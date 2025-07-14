import { initializeApp, cert, getApps, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage, Storage } from "firebase-admin/storage";

// Validate required environment variables
const requiredEnvVars = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
  }
}

// Define types for our Firebase admin services
interface FirebaseAdmin {
  app: App;
  auth: ReturnType<typeof getAuth>;
  db: ReturnType<typeof getFirestore>;
  storage: Storage;
}

// Initialize Firebase Admin
const initFirebaseAdmin = (): FirebaseAdmin => {
  try {
    // Get existing app if it exists
    const existingApp = getApps().find(app => app.name === 'server');
    
    // Initialize the app if it doesn't exist
    const app = existingApp || initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\\\n/g, '\n'),
      }),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    }, 'server');

    // Initialize services
    const auth = getAuth(app);
    const db = getFirestore(app);
    
    // Initialize storage with explicit bucket name
    const storage = getStorage(app);
    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    
    console.log(`Firebase Admin initialized with bucket: ${bucketName}`);
    
    return { app, auth, db, storage };
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
    throw new Error('Failed to initialize Firebase Admin. Please check your configuration.');
  }
};

// Initialize and export Firebase Admin services
const firebaseAdmin = initFirebaseAdmin();

export const { auth, db, storage } = firebaseAdmin;