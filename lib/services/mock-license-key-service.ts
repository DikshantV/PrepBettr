// lib/services/mock-license-key-service.ts

import { getAdminFirestore } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { LicenseKey, EmailVerification, AllowListEntry } from '@/types/subscription';
import { randomBytes } from 'crypto';

export class MockLicenseKeyService {
  private db = getAdminFirestore();

  /**
   * Generate and create a license key (mock version)
   */
  async generateLicenseKey(
    userId: string, 
    email: string,
    activationLimit: number = 1,
    expiresInDays: number = 365
  ): Promise<{ success: boolean; licenseKey?: string; error?: string }> {
    try {
      // Generate mock license key
      const licenseKey = 'MOCK-' + randomBytes(16).toString('hex').toUpperCase();
      
      // Calculate expiry date
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);

      // Store license key in our database
      const licenseKeyData: Omit<LicenseKey, 'id'> = {
        key: licenseKey,
        userId,
        status: 'inactive', // Will be activated when user activates it
        activatedAt: null,
        expiresAt,
        activationLimit,
        activationCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.db.collection('license_keys').add(licenseKeyData);

      console.log(`Mock license key generated for user ${userId}: ${licenseKey}`);

      return {
        success: true,
        licenseKey
      };

    } catch (error) {
      console.error('Error generating mock license key:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate license key'
      };
    }
  }

  /**
   * Validate and activate a license key
   */
  async activateLicenseKey(
    userId: string, 
    licenseKey: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if license key exists in our database
      const licenseSnapshot = await this.db
        .collection('license_keys')
        .where('key', '==', licenseKey)
        .limit(1)
        .get();

      if (licenseSnapshot.empty) {
        return {
          success: false,
          error: 'License key not found'
        };
      }

      const licenseDoc = licenseSnapshot.docs[0];
      const licenseData = licenseDoc.data() as LicenseKey;

      // Check if license is already activated by another user
      if (licenseData.status === 'active' && licenseData.userId !== userId) {
        return {
          success: false,
          error: 'License key is already activated by another user'
        };
      }

      // Check activation limit
      if (licenseData.activationCount >= licenseData.activationLimit) {
        return {
          success: false,
          error: 'License key activation limit exceeded'
        };
      }

      // Check expiry
      if (licenseData.expiresAt && licenseData.expiresAt < new Date()) {
        return {
          success: false,
          error: 'License key has expired'
        };
      }

      // Activate the license key
      const batch = this.db.batch();

      // Update license key document
      batch.update(licenseDoc.ref, {
        userId,
        status: 'active',
        activatedAt: FieldValue.serverTimestamp(),
        activationCount: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp()
      });

      // Update user's subscription
      const userDoc = this.db.collection('users').doc(userId);
      batch.update(userDoc, {
        plan: 'premium',
        planStatus: 'active',
        licenseKey: licenseKey,
        licenseKeyStatus: 'active',
        licenseKeyActivatedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });

      await batch.commit();

      console.log(`License key activated for user ${userId}: ${licenseKey}`);

      return { success: true };

    } catch (error) {
      console.error('Error activating license key:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to activate license key'
      };
    }
  }

  /**
   * Validate license key status
   */
  async validateLicenseKey(
    licenseKey: string
  ): Promise<{ valid: boolean; userId?: string; error?: string }> {
    try {
      // Check our database
      const licenseSnapshot = await this.db
        .collection('license_keys')
        .where('key', '==', licenseKey)
        .where('status', '==', 'active')
        .limit(1)
        .get();

      if (licenseSnapshot.empty) {
        return { valid: false, error: 'License key not found or not active' };
      }

      const licenseData = licenseSnapshot.docs[0].data() as LicenseKey;

      // Check expiry
      if (licenseData.expiresAt && licenseData.expiresAt < new Date()) {
        // Update status to expired
        await licenseSnapshot.docs[0].ref.update({
          status: 'expired',
          updatedAt: FieldValue.serverTimestamp()
        });

        return { valid: false, error: 'License key has expired' };
      }

      return { 
        valid: true, 
        userId: licenseData.userId 
      };

    } catch (error) {
      console.error('Error validating license key:', error);
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Failed to validate license key'
      };
    }
  }

  /**
   * Deactivate a license key
   */
  async deactivateLicenseKey(licenseKey: string): Promise<{ success: boolean; error?: string }> {
    try {
      const licenseSnapshot = await this.db
        .collection('license_keys')
        .where('key', '==', licenseKey)
        .limit(1)
        .get();

      if (licenseSnapshot.empty) {
        return { success: false, error: 'License key not found' };
      }

      const licenseDoc = licenseSnapshot.docs[0];
      const licenseData = licenseDoc.data() as LicenseKey;

      // Update license key status
      await licenseDoc.ref.update({
        status: 'inactive',
        updatedAt: FieldValue.serverTimestamp()
      });

      // Update user's subscription back to free
      if (licenseData.userId) {
        await this.db.collection('users').doc(licenseData.userId).update({
          plan: 'free',
          planStatus: 'active',
          licenseKey: null,
          licenseKeyStatus: null,
          licenseKeyActivatedAt: null,
          updatedAt: FieldValue.serverTimestamp()
        });
      }

      return { success: true };

    } catch (error) {
      console.error('Error deactivating license key:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to deactivate license key'
      };
    }
  }

  /**
   * Send license key via email (mock)
   */
  async sendLicenseKeyEmail(
    email: string, 
    licenseKey: string, 
    userName?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const emailContent = `
        Dear ${userName || 'User'},

        Thank you for your purchase! Your premium license key is ready to activate.

        License Key: ${licenseKey}

        To activate your premium features:
        1. Go to your account settings
        2. Navigate to the "License Key" section
        3. Enter the license key above
        4. Click "Activate"

        Once activated, you'll have unlimited access to all premium features including:
        - Unlimited interviews
        - Unlimited resume tailoring
        - Unlimited auto-apply actions

        If you have any questions, please contact our support team.

        Best regards,
        The PrepBettr Team
      `;

      console.log('📧 MOCK EMAIL SENT:');
      console.log('To:', email);
      console.log('Subject: Your PrepBettr Premium License Key');
      console.log('Content:', emailContent);

      return { success: true };

    } catch (error) {
      console.error('Error sending mock email:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send email'
      };
    }
  }

  /**
   * Check if user is in allow-list for free premium access
   */
  async isInAllowList(email: string, environment: string = 'production'): Promise<boolean> {
    try {
      const allowListSnapshot = await this.db
        .collection('allow_list')
        .where('email', '==', email)
        .where('active', '==', true)
        .where('environment', 'in', [environment, 'all'])
        .limit(1)
        .get();

      return !allowListSnapshot.empty;

    } catch (error) {
      console.error('Error checking allow-list:', error);
      return false;
    }
  }

  /**
   * Add user to allow-list
   */
  async addToAllowList(
    email: string, 
    environment: 'staging' | 'production' | 'all',
    reason: string,
    userId?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const allowListEntry: Omit<AllowListEntry, 'id'> = {
        email,
        userId,
        environment,
        reason,
        createdAt: new Date(),
        active: true
      };

      await this.db.collection('allow_list').add(allowListEntry);

      console.log(`Added ${email} to allow-list for ${environment} environment`);

      return { success: true };

    } catch (error) {
      console.error('Error adding to allow-list:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add to allow-list'
      };
    }
  }

  /**
   * Get license key details
   */
  async getLicenseKeyDetails(licenseKey: string): Promise<LicenseKey | null> {
    try {
      const licenseSnapshot = await this.db
        .collection('license_keys')
        .where('key', '==', licenseKey)
        .limit(1)
        .get();

      if (licenseSnapshot.empty) {
        return null;
      }

      const licenseDoc = licenseSnapshot.docs[0];
      return {
        id: licenseDoc.id,
        ...licenseDoc.data()
      } as LicenseKey;

    } catch (error) {
      console.error('Error getting license key details:', error);
      return null;
    }
  }
}

// Export singleton instance
export const mockLicenseKeyService = new MockLicenseKeyService();
