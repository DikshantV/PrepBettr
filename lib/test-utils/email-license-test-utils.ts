// lib/test-utils/email-license-test-utils.ts

import { getAdminFirestore } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { randomBytes } from 'crypto';

export class EmailLicenseTestUtils {
  private db = getAdminFirestore();

  /**
   * Create a test user with all necessary fields
   */
  async createTestUser(
    userId: string, 
    email: string, 
    name: string = 'Test User',
    emailVerified: boolean = false
  ) {
    const userData = {
      uid: userId,
      email,
      name,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      // Subscription fields
      plan: 'free',
      planStatus: 'active',
      currentPeriodEnd: null,
      dodoCustomerId: null,
      dodoSubscriptionId: null,
      licenseKey: null,
      licenseKeyStatus: null,
      licenseKeyActivatedAt: null,
      emailVerified
    };

    await this.db.collection('users').doc(userId).set(userData);
    
    // Initialize usage counters
    const usageCounters = {
      interviews: { count: 0, limit: 3, updatedAt: FieldValue.serverTimestamp() },
      resumeTailor: { count: 0, limit: 3, updatedAt: FieldValue.serverTimestamp() },
      autoApply: { count: 0, limit: 3, updatedAt: FieldValue.serverTimestamp() }
    };

    const batch = this.db.batch();
    Object.entries(usageCounters).forEach(([feature, counter]) => {
      const counterRef = this.db
        .collection('usage')
        .doc(userId)
        .collection('counters')
        .doc(feature);
      batch.set(counterRef, counter);
    });

    await batch.commit();

    console.log(`✅ Test user created: ${userId} (${email}), emailVerified: ${emailVerified}`);
    return userData;
  }

  /**
   * Create a test email verification record
   */
  async createTestEmailVerification(userId: string, email: string) {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const verificationData = {
      userId,
      email,
      token,
      verified: false,
      createdAt: new Date(),
      verifiedAt: null,
      expiresAt
    };

    await this.db.collection('email_verifications').add(verificationData);

    console.log(`✅ Email verification created for ${email}`);
    console.log(`📧 Verification URL: http://localhost:3000/api/auth/verify-email?token=${token}`);
    
    return { token, verificationData };
  }

  /**
   * Create a test license key (mock)
   */
  async createTestLicenseKey(userId: string, email: string) {
    const licenseKey = 'TEST-' + randomBytes(16).toString('hex').toUpperCase();
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1); // 1 year

    const licenseData = {
      key: licenseKey,
      userId,
      status: 'inactive', // Will be activated when user activates it
      activatedAt: null,
      expiresAt,
      activationLimit: 1,
      activationCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.db.collection('license_keys').add(licenseData);

    console.log(`✅ Test license key created: ${licenseKey}`);
    console.log(`🔑 Use this license key to test activation`);
    
    return { licenseKey, licenseData };
  }

  /**
   * Add user to allow-list for testing
   */
  async addToTestAllowList(email: string, environment: 'staging' | 'production' | 'all' = 'all') {
    const allowListEntry = {
      email,
      environment,
      reason: 'Test account for development',
      createdAt: new Date(),
      active: true
    };

    await this.db.collection('allow_list').add(allowListEntry);
    console.log(`✅ Added ${email} to allow-list for ${environment} environment`);
  }

  /**
   * Get user's current status
   */
  async getUserStatus(userId: string) {
    const userDoc = await this.db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return null;
    }

    const userData = userDoc.data();

    // Get usage counters
    const countersSnapshot = await this.db
      .collection('usage')
      .doc(userId)
      .collection('counters')
      .get();

    const usage: any = {};
    countersSnapshot.docs.forEach(doc => {
      usage[doc.id] = doc.data();
    });

    // Check email verification
    const verificationSnapshot = await this.db
      .collection('email_verifications')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    const hasVerification = !verificationSnapshot.empty;
    const latestVerification = hasVerification ? verificationSnapshot.docs[0].data() : null;

    return {
      user: userData,
      usage,
      emailVerification: {
        hasVerification,
        latest: latestVerification
      }
    };
  }

  /**
   * Clean up test data
   */
  async cleanupTestData(userId: string) {
    const batch = this.db.batch();

    // Delete user
    batch.delete(this.db.collection('users').doc(userId));

    // Delete usage counters
    const countersSnapshot = await this.db
      .collection('usage')
      .doc(userId)
      .collection('counters')
      .get();

    countersSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Delete email verifications
    const verificationsSnapshot = await this.db
      .collection('email_verifications')
      .where('userId', '==', userId)
      .get();

    verificationsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Delete license keys
    const licenseSnapshot = await this.db
      .collection('license_keys')
      .where('userId', '==', userId)
      .get();

    licenseSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    console.log(`🧹 Cleaned up test data for user: ${userId}`);
  }

  /**
   * Simulate usage increment to test limits
   */
  async simulateUsage(userId: string, feature: 'interviews' | 'resumeTailor' | 'autoApply', count: number = 1) {
    const counterRef = this.db
      .collection('usage')
      .doc(userId)
      .collection('counters')
      .doc(feature);

    await counterRef.update({
      count: FieldValue.increment(count),
      updatedAt: FieldValue.serverTimestamp()
    });

    console.log(`📊 Incremented ${feature} usage by ${count} for user ${userId}`);
  }
}

// Export singleton
export const testUtils = new EmailLicenseTestUtils();
