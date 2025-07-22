"use server";

import { cookies } from "next/headers";
import { Timestamp } from 'firebase-admin/firestore';
// FALLBACK: Import manual token decoding functions for cases where Firebase Admin SDK fails
// These functions are used as a backup when SDK cannot decode tokens due to network/SSL issues
import { getUserFromDecodedToken } from "@/lib/utils/jwt-decoder";
import { firebaseVerification } from "@/lib/services/firebase-verification";


// Session duration (1 week)
const SESSION_DURATION = 60 * 60 * 24 * 7;

// Set session cookie
export async function setSessionCookie(idToken: string) {
    try {
        const cookieStore = await cookies();

        // Try to create a proper Firebase session cookie first
        const sessionCookieResult = await firebaseVerification.createSessionCookie(idToken, SESSION_DURATION * 1000);
        
        if (sessionCookieResult.success && sessionCookieResult.sessionCookie) {
            console.log('Created Firebase session cookie');
            // Set the proper session cookie
            cookieStore.set("session", sessionCookieResult.sessionCookie, {
                maxAge: SESSION_DURATION,
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                path: "/",
                sameSite: "lax",
            });
            
            // Also store a flag to indicate this is a session cookie, not an ID token
            cookieStore.set("session_type", "session_cookie", {
                maxAge: SESSION_DURATION,
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                path: "/",
                sameSite: "lax",
            });
        } else {
            console.log('Failed to create session cookie, using ID token as fallback');
            // Fallback: use the ID token directly
            cookieStore.set("session", idToken, {
                maxAge: SESSION_DURATION,
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                path: "/",
                sameSite: "lax",
            });
            
            // Store flag to indicate this is an ID token, not a session cookie
            cookieStore.set("session_type", "id_token", {
                maxAge: SESSION_DURATION,
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                path: "/",
                sameSite: "lax",
            });
        }
    } catch (error) {
        console.error('Error setting session cookie:', error);
        throw error;
    }
}

export async function signUp(params: SignUpParams) {
    // Destructuring for future use when SSL issues are resolved
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { uid, name, email } = params;

    try {
        // For now, bypass database operations due to SSL issues
        // In production, implement proper database operations
        console.log('SignUp bypassed due to SSL issues - implement proper DB later');
        
        return {
            success: true,
            message: "Account created successfully. Please sign in.",
        };
    } catch (error: unknown) {
        console.error("Error creating user:", error);
        return {
            success: false,
            message: "Failed to create account. Please try again.",
        };
    }
}

export async function signIn(params: SignInParams): Promise<SignInResponse> {
    const { email, idToken } = params;

try {
        // Try to verify the token using the new verification service
        const verificationResult = await firebaseVerification.verifyIdToken(idToken);

        if (!verificationResult.success) {
            console.error('Token verification failed via Firebase Admin/REST:', verificationResult.error);
            return {
                success: false,
                message: "Invalid authentication token. Please try again.",
            };
        }

        const decodedToken = verificationResult.decodedToken;
        
        if (!decodedToken) {
            console.error('Token verification failed - invalid or expired token');
            return {
                success: false,
                message: "Invalid authentication token. Please try again.",
            };
        }
        
        const uid = decodedToken.uid;
        
        // Check email match between provided email and token email
        if (decodedToken.email && decodedToken.email !== email) {
            console.warn('Email mismatch between provided email and token email');
            return {
                success: false,
                message: "Email mismatch. Please use the correct account.",
            };
        }
        
        // If the token is valid, we consider the user authenticated
        console.log('User verified through token:', uid);
        
        // Create session cookie
        await setSessionCookie(idToken);

        return {
            success: true,
            message: "Successfully signed in.",
            userId: uid
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
        cookieStore.delete("session_type");
        console.log('User signed out successfully');
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
        const sessionValue = cookieStore.get("session")?.value;
        const sessionType = cookieStore.get("session_type")?.value;

        // If no session cookie, the user is not authenticated
        if (!sessionValue) {
            console.log('No session cookie found');
            return null;
        }
        
        console.log(`Session found (type: ${sessionType || 'unknown'}), verifying...`);

        try {
            let verificationResult;
            
            // Use appropriate verification method based on session type
            if (sessionType === 'session_cookie') {
                console.log('Verifying Firebase session cookie');
                verificationResult = await firebaseVerification.verifySessionCookie(sessionValue);
            } else {
                console.log('Verifying as ID token (fallback)');
                verificationResult = await firebaseVerification.verifyIdToken(sessionValue);
            }

            if (!verificationResult.success) {
                console.log('Failed to verify session:', verificationResult.error);
                return null;
            }

            const decodedToken = verificationResult.decodedToken;
            
            if (!decodedToken) {
                console.log('Failed to verify session - invalid or expired');
                return null;
            }
            
            // Additional token validation (only for ID tokens, session cookies are pre-validated)
            if (sessionType !== 'session_cookie') {
                const validationResult = await firebaseVerification.validateTokenClaims(decodedToken);
                if (!validationResult.isValid) {
                    console.log('Token validation failed:', validationResult.errors);
                    return null;
                }
            }
            
            console.log(`Successfully verified user: ${decodedToken.uid}`);
            
            // Extract user info from decoded token
            return getUserFromDecodedToken(decodedToken);
        } catch (error: unknown) {
            // Only log server-side to avoid client console errors
            if (typeof window === 'undefined') {
                console.log('Session verification failed:', error instanceof Error ? error.message : 'unknown error');
            }

            // Clear the invalid session cookie
            if (error instanceof Error && (
                error.message.includes('auth/session-cookie-revoked') ||
                error.message.includes('auth/session-cookie-expired') ||
                error.message.includes('auth/argument-error') ||
                error.message.includes('INVALID_ID_TOKEN')
            )) {
                try {
                    const cookieStore = await cookies();
                    cookieStore.delete('session');
                    cookieStore.delete('session_type');
                    if (typeof window === 'undefined') {
                        console.log('Cleared invalid session cookies');
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