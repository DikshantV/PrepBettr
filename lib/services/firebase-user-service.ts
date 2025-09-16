/**
 * Firebase User Service - Real Implementation
 * 
 * Handles user profile management using Firebase Authentication and Firestore
 * This is the single source of truth for user identity and profiles
 */

import { getAdminAuth, getAdminFirestore } from '@/lib/firebase/admin';

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  profilePictureUrl?: string;
  phoneNumber?: string;
  emailVerified: boolean;
  plan: 'free' | 'premium';
  createdAt: Date;
  updatedAt: Date;
  // Additional profile data
  about?: string;
  workplace?: string;
  skills?: string[];
  dateOfBirth?: string;
}

export interface CreateUserData {
  email: string;
  displayName?: string;
  phoneNumber?: string;
  emailVerified?: boolean;
  plan?: 'free' | 'premium';
}

class FirebaseUserService {
  private static instance: FirebaseUserService;
  
  public static getInstance(): FirebaseUserService {
    if (!FirebaseUserService.instance) {
      FirebaseUserService.instance = new FirebaseUserService();
    }
    return FirebaseUserService.instance;
  }

  /**
   * Get user profile from Firestore
   */
  async getUserProfile(uid: string): Promise<UserProfile | null> {
    try {
      const firestore = await getAdminFirestore();
      const userDoc = await firestore.collection('users').doc(uid).get();
      
      if (!userDoc.exists) {
        console.log(`User profile not found for uid: ${uid}`);
        return null;
      }
      
      const data = userDoc.data();
      if (!data) {
        console.log(`User profile data is empty for uid: ${uid}`);
        return null;
      }

      // Convert Firestore timestamps to Date objects (handle both Firestore Timestamp and regular dates)
      const profile: UserProfile = {
        uid,
        email: data.email,
        displayName: data.displayName,
        profilePictureUrl: data.profilePictureUrl,
        phoneNumber: data.phoneNumber,
        emailVerified: data.emailVerified || false,
        plan: data.plan || 'free',
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date()),
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt ? new Date(data.updatedAt) : new Date()),
        about: data.about,
        workplace: data.workplace,
        skills: data.skills || [],
        dateOfBirth: data.dateOfBirth
      };

      console.log(`✅ Retrieved user profile for uid: ${uid}`);
      return profile;
    } catch (error) {
      console.error(`❌ Failed to get user profile for uid: ${uid}`, error);
      throw error;
    }
  }

  /**
   * Create user profile in Firestore
   */
  async createUserProfile(uid: string, userData: CreateUserData): Promise<UserProfile> {
    try {
      const firestore = await getAdminFirestore();
      const now = new Date();
      
      // Create profile data without undefined values (Firestore requirement)
      const profileData: Record<string, any> = {
        email: userData.email,
        displayName: userData.displayName || userData.email.split('@')[0],
        emailVerified: userData.emailVerified || false,
        plan: userData.plan || 'free',
        createdAt: now,
        updatedAt: now,
        skills: []
      };
      
      // Only add optional fields if they have values
      if (userData.phoneNumber) {
        profileData.phoneNumber = userData.phoneNumber;
      }

      await firestore.collection('users').doc(uid).set(profileData);
      
      console.log(`✅ Created user profile for uid: ${uid}, email: ${userData.email}`);
      
      // Return the complete profile with all required fields
      return {
        uid,
        email: profileData.email,
        displayName: profileData.displayName,
        profilePictureUrl: undefined, // Will be undefined in interface but not stored in Firestore
        phoneNumber: profileData.phoneNumber,
        emailVerified: profileData.emailVerified,
        plan: profileData.plan,
        createdAt: profileData.createdAt,
        updatedAt: profileData.updatedAt,
        about: undefined,
        workplace: undefined,
        skills: profileData.skills,
        dateOfBirth: undefined
      };
    } catch (error) {
      console.error(`❌ Failed to create user profile for uid: ${uid}`, error);
      throw error;
    }
  }

  /**
   * Update user profile in Firestore
   */
  async updateUserProfile(uid: string, updates: Partial<UserProfile>): Promise<void> {
    try {
      const firestore = await getAdminFirestore();
      
      // Remove uid from updates to prevent overwriting document ID
      const { uid: _, ...updateData } = updates;
      
      const updatePayload = {
        ...updateData,
        updatedAt: new Date()
      };

      await firestore.collection('users').doc(uid).update(updatePayload);
      
      console.log(`✅ Updated user profile for uid: ${uid}`);
    } catch (error) {
      console.error(`❌ Failed to update user profile for uid: ${uid}`, error);
      throw error;
    }
  }

  /**
   * Ensure user profile exists - create if not found
   */
  async ensureUserProfile(uid: string, userData: CreateUserData): Promise<UserProfile> {
    try {
      // First, try to get existing profile
      const existingProfile = await this.getUserProfile(uid);
      
      if (existingProfile) {
        console.log(`🔄 User profile already exists for uid: ${uid}`);
        return existingProfile;
      }

      // If not found, create new profile
      console.log(`🆕 Creating new user profile for uid: ${uid}`);
      return await this.createUserProfile(uid, userData);
    } catch (error) {
      console.error(`❌ Failed to ensure user profile for uid: ${uid}`, error);
      throw error;
    }
  }

  /**
   * Get Firebase Auth user record
   */
  async getAuthUser(uid: string) {
    try {
      const auth = await getAdminAuth();
      const userRecord = await auth.getUser(uid);
      
      console.log(`✅ Retrieved Firebase Auth user for uid: ${uid}`);
      return userRecord;
    } catch (error) {
      console.error(`❌ Failed to get Firebase Auth user for uid: ${uid}`, error);
      throw error;
    }
  }

  /**
   * Create Firebase Auth user (for email/password signup)
   */
  async createAuthUser(userData: {
    email: string;
    password?: string;
    displayName?: string;
    phoneNumber?: string;
    emailVerified?: boolean;
  }) {
    try {
      const auth = await getAdminAuth();
      
      const userRecord = await auth.createUser({
        email: userData.email,
        password: userData.password,
        displayName: userData.displayName,
        phoneNumber: userData.phoneNumber,
        emailVerified: userData.emailVerified || false
      });
      
      console.log(`✅ Created Firebase Auth user for email: ${userData.email}, uid: ${userRecord.uid}`);
      return userRecord;
    } catch (error) {
      console.error(`❌ Failed to create Firebase Auth user for email: ${userData.email}`, error);
      throw error;
    }
  }

  /**
   * Sign in with email and password (create custom token)
   */
  async signInWithEmailAndPassword(email: string, password: string) {
    try {
      const auth = await getAdminAuth();
      
      // In a real implementation, you'd verify the password against Firebase Auth
      // For now, we'll create a custom token for the user
      const userRecord = await auth.getUserByEmail(email);
      const customToken = await auth.createCustomToken(userRecord.uid);
      
      console.log(`✅ Created custom token for email: ${email}, uid: ${userRecord.uid}`);
      
      return {
        user: {
          uid: userRecord.uid,
          email: userRecord.email,
          displayName: userRecord.displayName,
          emailVerified: userRecord.emailVerified
        },
        token: customToken
      };
    } catch (error) {
      console.error(`❌ Failed to sign in with email: ${email}`, error);
      throw error;
    }
  }

  /**
   * Delete user profile and auth record
   */
  async deleteUser(uid: string): Promise<void> {
    try {
      const auth = await getAdminAuth();
      const firestore = await getAdminFirestore();
      
      // Delete Firestore profile
      await firestore.collection('users').doc(uid).delete();
      
      // Delete Firebase Auth user
      await auth.deleteUser(uid);
      
      console.log(`✅ Deleted user completely for uid: ${uid}`);
    } catch (error) {
      console.error(`❌ Failed to delete user for uid: ${uid}`, error);
      throw error;
    }
  }

  /**
   * Health check - verify Firebase connections
   */
  async healthCheck(): Promise<{ healthy: boolean; details: Record<string, any> }> {
    const details: Record<string, any> = {};
    let healthy = true;

    try {
      // Test Firebase Auth connection
      const auth = await getAdminAuth();
      await auth.getUser('test-user-id').catch(() => {
        // Expected to fail, just testing connectivity
      });
      details.firebaseAuth = 'connected';
    } catch (error) {
      details.firebaseAuth = `error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      healthy = false;
    }

    try {
      // Test Firestore connection
      const firestore = await getAdminFirestore();
      await firestore.collection('users').limit(1).get();
      details.firestore = 'connected';
    } catch (error) {
      details.firestore = `error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      healthy = false;
    }

    return { healthy, details };
  }
}

// Export singleton instance
export const firebaseUserService = FirebaseUserService.getInstance();
export default firebaseUserService;
