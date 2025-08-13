import { getFirestore } from "firebase/firestore";
import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_CLIENT_KEY,
    authDomain: "prepbettr.firebaseapp.com",
    projectId: "prepbettr",
    storageBucket: "prepbettr.firebasestorage.app", // Make sure this is correct
    messagingSenderId: "660242808945",
    appId: "1:660242808945:web:4edbaac82ed140f4d05bd0",
    measurementId: "G-LF6KN9F2HY"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firebase services
const auth = getAuth(app);
const db = getFirestore(app);

const googleProvider = new GoogleAuthProvider();

export { auth, db, googleProvider, app };
