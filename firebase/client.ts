import { getStorage } from "firebase/storage";
import { getFirestore } from "firebase/firestore";
import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getAnalytics, isSupported } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAsTYUzEURUz1LaQWSwreqc7fnoN-WS0S8",
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
const storage = getStorage(app);

// Only initialize Analytics in the browser
let analytics;
if (typeof window !== 'undefined') {
    isSupported().then(yes => {
        if (yes) analytics = getAnalytics(app);
    });
}

const googleProvider = new GoogleAuthProvider();

export { auth, db, storage, analytics, googleProvider };