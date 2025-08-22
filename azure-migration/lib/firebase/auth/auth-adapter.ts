/**
 * Firebase Auth Adapter
 * 
 * Adapter for Firebase Authentication service
 * This is a stub since Firebase services are being phased out
 */

import { IAuthService, AuthVerificationResult, AuthUser } from '../../shared/interfaces';

export class FirebaseAuthAdapter implements IAuthService {
  async initialize(): Promise<void> {
    // Stub implementation
    console.warn('Firebase Auth Adapter is deprecated - use unified auth system instead');
  }

  async signIn(email: string, password: string): Promise<any> {
    throw new Error('Firebase Auth Adapter deprecated - use unified auth system');
  }

  async signOut(): Promise<void> {
    // Stub implementation
  }

  async getCurrentUser(): Promise<any> {
    return null;
  }

  async verifyToken(token: string): Promise<AuthVerificationResult> {
    return {
      success: false,
      error: 'Firebase Auth Adapter deprecated - use unified auth system',
      method: 'firebase-admin'
    };
  }

  async createUser(userData: Partial<AuthUser>): Promise<AuthUser> {
    throw new Error('Firebase Auth Adapter deprecated - use unified auth system');
  }

  async updateUser(uid: string, userData: Partial<AuthUser>): Promise<void> {
    throw new Error('Firebase Auth Adapter deprecated - use unified auth system');
  }

  async deleteUser(uid: string): Promise<void> {
    throw new Error('Firebase Auth Adapter deprecated - use unified auth system');
  }

  async getUser(uid: string): Promise<AuthUser | null> {
    return null;
  }

  async setCustomClaims(uid: string, claims: Record<string, any>): Promise<void> {
    throw new Error('Firebase Auth Adapter deprecated - use unified auth system');
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    return {
      healthy: false,
      message: 'Firebase Auth Adapter is deprecated'
    };
  }
}
