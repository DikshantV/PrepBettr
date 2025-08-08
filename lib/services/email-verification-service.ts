// lib/services/email-verification-service.ts

import { getAdminFirestore } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { EmailVerification } from '@/types/subscription';
import { randomBytes } from 'crypto';
import { awsSESService } from './aws-ses-service';

export class EmailVerificationService {
  private _db: ReturnType<typeof getAdminFirestore> | null = null;
  
  private get db() {
    if (!this._db) {
      this._db = getAdminFirestore();
    }
    return this._db;
  }

  /**
   * Generate and send email verification token
   */
  async sendVerificationEmail(
    userId: string, 
    email: string, 
    userName?: string
  ): Promise<{ success: boolean; token?: string; error?: string }> {
    try {
      // Generate secure verification token
      const token = randomBytes(32).toString('hex');
      
      // Set expiry to 24 hours from now
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      // Create verification record
      const verificationData: Omit<EmailVerification, 'id'> = {
        userId,
        email,
        token,
        verified: false,
        createdAt: new Date(),
        verifiedAt: null,
        expiresAt
      };

      // Store in database
      await this.db.collection('email_verifications').add(verificationData);

      // Create verification URL
      const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL || 'http://localhost:3000';
      const verificationUrl = `${baseUrl}/api/auth/verify-email?token=${token}`;

      // Email content
      const emailContent = `
        Dear ${userName || 'User'},

        Please verify your email address to complete your account setup and enable premium features.

        Click the link below to verify your email:
        ${verificationUrl}

        This link will expire in 24 hours.

        If you didn't create an account with PrepBettr, you can safely ignore this email.

        Best regards,
        The PrepBettr Team
      `;

      console.log('Email verification to be sent:', {
        to: email,
        subject: 'Verify your PrepBettr account',
        content: emailContent,
        verificationUrl
      });

      const { success, error } = await awsSESService.sendEmail({
        to: email,
        subject: 'Verify your PrepBettr account',
        html: emailContent
      });

      if (!success) throw new Error(error);

      console.log(`Email verification sent to ${email} for user ${userId}`);

      return { 
        success: true, 
        token 
      };

    } catch (error) {
      console.error('Error sending verification email:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send verification email'
      };
    }
  }

  /**
   * Verify email using token
   */
  async verifyEmail(token: string): Promise<{ success: boolean; userId?: string; error?: string }> {
    try {
      // Find verification record
      const verificationSnapshot = await this.db
        .collection('email_verifications')
        .where('token', '==', token)
        .where('verified', '==', false)
        .limit(1)
        .get();

      if (verificationSnapshot.empty) {
        return {
          success: false,
          error: 'Invalid or expired verification token'
        };
      }

      const verificationDoc = verificationSnapshot.docs[0];
      const verificationData = verificationDoc.data() as EmailVerification;

      // Check if token has expired
      if (verificationData.expiresAt < new Date()) {
        return {
          success: false,
          error: 'Verification token has expired'
        };
      }

      // Update verification record
      const batch = this.db.batch();

      batch.update(verificationDoc.ref, {
        verified: true,
        verifiedAt: FieldValue.serverTimestamp()
      });

      // Update user's email verification status
      const userDoc = this.db.collection('users').doc(verificationData.userId);
      batch.update(userDoc, {
        emailVerified: true,
        updatedAt: FieldValue.serverTimestamp()
      });

      await batch.commit();

      console.log(`Email verified for user ${verificationData.userId}`);

      return {
        success: true,
        userId: verificationData.userId
      };

    } catch (error) {
      console.error('Error verifying email:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to verify email'
      };
    }
  }

  /**
   * Check if user's email is verified
   */
  async isEmailVerified(userId: string): Promise<boolean> {
    try {
      const userDoc = await this.db.collection('users').doc(userId).get();
      
      if (!userDoc.exists) {
        return false;
      }

      const userData = userDoc.data();
      return userData?.emailVerified === true;

    } catch (error) {
      console.error('Error checking email verification:', error);
      return false;
    }
  }

  /**
   * Resend verification email
   */
  async resendVerificationEmail(
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get user data
      const userDoc = await this.db.collection('users').doc(userId).get();
      
      if (!userDoc.exists) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      const userData = userDoc.data();
      
      if (userData?.emailVerified === true) {
        return {
          success: false,
          error: 'Email is already verified'
        };
      }

      // Invalidate any existing unverified tokens for this user
      const existingTokensSnapshot = await this.db
        .collection('email_verifications')
        .where('userId', '==', userId)
        .where('verified', '==', false)
        .get();

      const batch = this.db.batch();
      existingTokensSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();

      // Send new verification email
      return await this.sendVerificationEmail(
        userId, 
        userData?.email, 
        userData?.name
      );

    } catch (error) {
      console.error('Error resending verification email:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to resend verification email'
      };
    }
  }

  /**
   * Get verification status for user
   */
  async getVerificationStatus(userId: string): Promise<{
    verified: boolean;
    pendingVerification: boolean;
    email?: string;
  }> {
    try {
      // Check user's verified status
      const userDoc = await this.db.collection('users').doc(userId).get();
      
      if (!userDoc.exists) {
        return { verified: false, pendingVerification: false };
      }

      const userData = userDoc.data();
      const verified = userData?.emailVerified === true;

      if (verified) {
        return { 
          verified: true, 
          pendingVerification: false,
          email: userData?.email
        };
      }

      // Check if there are pending verifications
      const pendingSnapshot = await this.db
        .collection('email_verifications')
        .where('userId', '==', userId)
        .where('verified', '==', false)
        .where('expiresAt', '>', new Date())
        .limit(1)
        .get();

      return {
        verified: false,
        pendingVerification: !pendingSnapshot.empty,
        email: userData?.email
      };

    } catch (error) {
      console.error('Error getting verification status:', error);
      return { verified: false, pendingVerification: false };
    }
  }

  /**
   * Clean up expired verification tokens
   */
  async cleanupExpiredTokens(): Promise<{ deleted: number }> {
    try {
      const expiredSnapshot = await this.db
        .collection('email_verifications')
        .where('expiresAt', '<', new Date())
        .where('verified', '==', false)
        .get();

      if (expiredSnapshot.empty) {
        return { deleted: 0 };
      }

      const batch = this.db.batch();
      expiredSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();

      console.log(`Cleaned up ${expiredSnapshot.docs.length} expired verification tokens`);

      return { deleted: expiredSnapshot.docs.length };

    } catch (error) {
      console.error('Error cleaning up expired tokens:', error);
      return { deleted: 0 };
    }
  }
}

// Export singleton instance
export const emailVerificationService = new EmailVerificationService();
