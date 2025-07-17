"use server";

import { auth, db } from "@/firebase/admin";

export async function deleteUser(uid: string) {
    try {
        // Delete user from Firebase Auth
        await auth.deleteUser(uid);

        // Delete user document from Firestore
        const userRef = db.collection("users").doc(uid);
        await userRef.delete();

        // Delete all interviews associated with this user
        const interviewsQuery = await db.collection("interviews").where("userId", "==", uid).get();
        const interviewBatch = db.batch();
        interviewsQuery.docs.forEach(doc => {
            interviewBatch.delete(doc.ref);
        });
        await interviewBatch.commit();

        // Delete all feedback associated with this user
        const feedbackQuery = await db.collection("feedback").where("userId", "==", uid).get();
        const feedbackBatch = db.batch();
        feedbackQuery.docs.forEach(doc => {
            feedbackBatch.delete(doc.ref);
        });
        await feedbackBatch.commit();

        return { success: true };
    } catch (error) {
        console.error("Error deleting user:", error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        return { success: false, error: errorMessage };
    }
}

export async function checkEmailUniqueness(email: string): Promise<boolean> {
    try {
        // Check if email exists in Firebase Auth
        const userRecord = await auth.getUserByEmail(email);
        if (userRecord) {
            return false; // Email already exists
        }

        // Double check in Firestore (defensive programming)
        const userQuery = await db.collection("users").where("email", "==", email).limit(1).get();
        if (!userQuery.empty) {
            return false; // Email exists in Firestore
        }

        return true; // Email is unique
    } catch (error) {
        console.error("Error checking email uniqueness:", error);
        return false;
    }
}
