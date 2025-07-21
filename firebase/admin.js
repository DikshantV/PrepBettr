"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.storage = exports.db = exports.auth = void 0;
const app_1 = require("firebase-admin/app");
const auth_1 = require("firebase-admin/auth");
const firestore_1 = require("firebase-admin/firestore");
const storage_1 = require("firebase-admin/storage");
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
// Initialize Firebase Admin
const initFirebaseAdmin = () => {
    var _a;
    try {
        // Get existing app if it exists
        const existingApp = (0, app_1.getApps)().find(app => app.name === 'server');
        // Initialize the app if it doesn't exist
        const app = existingApp || (0, app_1.initializeApp)({
            credential: (0, app_1.cert)({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: (_a = process.env.FIREBASE_PRIVATE_KEY) === null || _a === void 0 ? void 0 : _a.replace(/\\\\n/g, '\n'),
            }),
            storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
        }, 'server');
        // Initialize services
        const auth = (0, auth_1.getAuth)(app);
        const db = (0, firestore_1.getFirestore)(app);
        // Initialize storage with explicit bucket name
        const storage = (0, storage_1.getStorage)(app);
        const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
        console.log(`Firebase Admin initialized with bucket: ${bucketName}`);
        return { app, auth, db, storage };
    }
    catch (error) {
        console.error('Failed to initialize Firebase Admin:', error);
        throw new Error('Failed to initialize Firebase Admin. Please check your configuration.');
    }
};
// Initialize and export Firebase Admin services
const firebaseAdmin = initFirebaseAdmin();
exports.auth = firebaseAdmin.auth, exports.db = firebaseAdmin.db, exports.storage = firebaseAdmin.storage;
