import {getFirestore} from "firebase/firestore";
import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyAsTYUzEURUz1LaQWSwreqc7fnoN-WS0S8",
    authDomain: "prepbettr.firebaseapp.com",
    projectId: "prepbettr",
    storageBucket: "prepbettr.firebasestorage.app",
    messagingSenderId: "660242808945",
    appId: "1:660242808945:web:4edbaac82ed140f4d05bd0",
    measurementId: "G-LF6KN9F2HY"
};

// Initialize Firebase
const app = !getApps.length ? initializeApp(firebaseConfig) :getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);