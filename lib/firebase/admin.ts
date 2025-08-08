import { getApps, initializeApp, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getStorage, Storage } from 'firebase-admin/storage';

let adminApp: App | null = null;
let adminAuth: Auth | null = null;
let adminDb: Firestore | null = null;
let adminStorage: Storage | null = null;

/**
 * Initialize Firebase Admin SDK with singleton pattern
 */
export function initializeFirebaseAdmin(): App {
  if (adminApp) {
    return adminApp;
  }

  const existingApps = getApps();
  if (existingApps.length > 0) {
    adminApp = existingApps[0];
    return adminApp;
  }

  // During build time, environment variables might be cleared
  // Skip Firebase initialization if we're in build mode
  if (process.env.NODE_ENV === 'production' && !process.env.FIREBASE_PROJECT_ID) {
    console.log('Skipping Firebase Admin initialization during build');
    // Create a proper mock app for build purposes
    adminApp = {
      name: 'mock-build-app',
      options: {},
      delete: async () => {},
    } as App;
    return adminApp;
  }

  try {
    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };

    if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
      console.warn('Missing Firebase service account credentials, creating mock app for build');
      adminApp = {
        name: 'mock-build-app',
        options: {},
        delete: async () => {},
      } as App;
      return adminApp;
    }

    adminApp = initializeApp({
      credential: cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${process.env.FIREBASE_PROJECT_ID}.appspot.com`,
    });

    console.log('Firebase Admin initialized successfully');
    return adminApp;
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
    // During build, return a mock app instead of throwing
    if (process.env.NODE_ENV === 'production') {
      console.log('Creating mock Firebase app for build process');
      adminApp = {
        name: 'mock-build-app',
        options: {},
        delete: async () => {},
      } as App;
      return adminApp;
    }
    throw new Error('Failed to initialize Firebase Admin SDK');
  }
}

/**
 * Get Firebase Admin Auth instance
 */
export function getAdminAuth(): Auth {
  if (!adminAuth) {
    const app = initializeFirebaseAdmin();
    // Handle build-time mock app
    if (app.name === 'mock-build-app') {
      adminAuth = {} as Auth;
    } else {
      adminAuth = getAuth(app);
    }
  }
  return adminAuth;
}

/**
 * Get Firebase Admin Firestore instance
 */
export function getAdminFirestore(): Firestore {
  if (!adminDb) {
    const app = initializeFirebaseAdmin();
    // Handle build-time mock app
    if (app.name === 'mock-build-app') {
      adminDb = {} as Firestore;
    } else {
      adminDb = getFirestore(app);
    }
  }
  return adminDb;
}

/**
 * Get Firebase Admin Storage instance
 */
export function getAdminStorage(): Storage {
  if (!adminStorage) {
    const app = initializeFirebaseAdmin();
    // Handle build-time mock app
    if (app.name === 'mock-build-app') {
      adminStorage = {} as Storage;
    } else {
      adminStorage = getStorage(app);
    }
  }
  return adminStorage;
}

/**
 * Helper to verify Firebase ID token
 */
export async function verifyIdToken(token: string) {
  try {
    const auth = getAdminAuth();
    const decodedToken = await auth.verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    console.error('Error verifying token:', error);
    return null;
  }
}
