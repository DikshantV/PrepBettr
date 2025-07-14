"use server";

import { auth, db } from "@/firebase/admin";
import { cookies } from "next/headers";
import {FirebaseError} from "@firebase/util";
import { Timestamp } from "@firebase/firestore";


// Session duration (1 week)
const SESSION_DURATION = 60 * 60 * 24 * 7;

// Set session cookie
export async function setSessionCookie(idToken: string) {
    try {
        const cookieStore = await cookies();

        // Create a session cookie
        const sessionCookie = await auth.createSessionCookie(idToken, {
            expiresIn: SESSION_DURATION * 1000, // milliseconds
        });

        // Set cookie in the browser
        cookieStore.set("session", sessionCookie, {
            maxAge: SESSION_DURATION,
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            path: "/",
            sameSite: "lax",
        });
    } catch (error) {
        console.error('Error setting session cookie:', error);
        throw error;
    }
}

export async function signUp(params: SignUpParams) {
    const { uid, name, email } = params;

    try {
        // check if a user exists in db
        const userRecord = await db.collection("users").doc(uid).get();
        if (userRecord.exists)
            return {
                success: false,
                message: "User already exists. Please sign in.",
            };

        // save user to db with the default profile image
        await db.collection("users").doc(uid).set({
            name,
            email,
            image: '/default-avatar.svg', // Set default profile image
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });

        return {
            success: true,
            message: "Account created successfully. Please sign in.",
        };
    } catch (error: unknown) {
        console.error("Error creating user:", error);

        // Handle Firebase specific errors
        if (error instanceof FirebaseError && error.code === "auth/email-already-exists") {
            return {
                success: false,
                message: "This email is already in use",
            };
        }

        return {
            success: false,
            message: "Failed to create account. Please try again.",
        };
    }
}

export async function signIn(params: SignInParams): Promise<SignInResponse> {
    const { email, idToken } = params;

    try {
        const userRecord = await auth.getUserByEmail(email);
        if (!userRecord)
            return {
                success: false,
                message: "User does not exist. Create an account.",
            };

        await setSessionCookie(idToken);

        return {
            success: true,
            message: "Successfully signed in.",
            userId: userRecord.uid
        };
    } catch (error) {
        console.error("Error in signIn:", error);
        return {
            success: false,
            message: "Failed to log into account. Please try again.",
        };
    }
}

// Sign out a user by clearing the session cookie
export async function signOut() {
    try {
        const cookieStore = await cookies();
        cookieStore.delete("session");
    } catch (error) {
        console.error('Error signing out:', error);
        throw error;
    }
}

// Get current user from session cookie
// Helper function to convert Firestore timestamps to plain objects
const convertTimestamps = (data: Record<string, unknown> | null | unknown[] | Timestamp): Record<string, unknown> | null | unknown[] | string => {
    if (data === null || typeof data !== 'object') return data;

    // Handle Firestore Timestamp
    if (data instanceof Timestamp) {
        return data.toDate().toISOString();
    }

    // Handle arrays
    if (Array.isArray(data)) {
        return data.map(item => convertTimestamps(item as Record<string, unknown> | null));
    }

    // Handle objects
    const result: Record<string, unknown> = {};
    for (const key in data) {
        result[key] = convertTimestamps(data[key] as Record<string, unknown> | Timestamp | unknown[] | null);
    }
    return result;
};

export async function getCurrentUser(): Promise<User | null> {
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get("session")?.value;

        // If no session cookie, the user is not authenticated
        if (!sessionCookie) {
            console.log('No session cookie found');
            return null;
        }

        try {
            // Verify the session cookie
            const decodedClaims = await auth.verifySessionCookie(sessionCookie, true);

            // Get user info from db
            const userRecord = await db
                .collection("users")
                .doc(decodedClaims.uid)
                .get();

            if (!userRecord.exists) {
                // Don't log this to the client console
                if (typeof window === 'undefined') {
                    console.log('User not found in database:', decodedClaims.uid);
                }
                return null;
            }

            // Convert Firestore timestamps to plain objects
            const userData = userRecord.data();
            if (!userData) {
                return null;
            }
            const serializedData = convertTimestamps(userData);

            // Ensure we have a valid object before spreading
            if (serializedData && typeof serializedData === 'object' && !Array.isArray(serializedData)) {
                return {
                    ...serializedData,
                    id: userRecord.id,
                } as User;
            }

            // If not a valid object, return the id only
            return {
                id: userRecord.id,
            } as User;
        } catch (error: unknown) {
            // Only log server-side to avoid client console errors
            if (typeof window === 'undefined') {
                console.log('Session verification status:', error instanceof Error ? error.message : 'invalid-session');
            }

            // Clear the invalid session cookie
            if (error instanceof Error && error.message.includes('auth/session-cookie-revoked') ||
                error instanceof Error && error.message.includes('auth/session-cookie-expired') ||
                error instanceof Error && error.message.includes('auth/argument-error')) {
                try {
                    const cookieStore = await cookies();
                    cookieStore.delete('session');
                    if (typeof window === 'undefined') {
                        console.log('Cleared invalid session cookie');
                    }
                } catch (cookieError) {
                    if (typeof window === 'undefined') {
                        console.error('Error clearing session cookie:', cookieError);
                    }
                }
            }

            return null;
        }
    } catch (error) {
        console.error('Unexpected error in getCurrentUser:', error);
        return null;
    }
}

// Check if the user is authenticated
export async function isAuthenticated() {
    const user = await getCurrentUser();
    return !!user;
}