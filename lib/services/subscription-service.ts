// lib/services/subscription-service.ts

import { getAdminFirestore } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import {
  PlanType,
  PlanStatus,
  UserSubscriptionFields,
  UserUsageCounters,
  UsageCounter,
  SubscriptionEvent,
  DEFAULT_USAGE_LIMITS,
  ExtendedUser
} from '@/types/subscription';
import { licenseKeyService } from './license-key-service';
import { mockLicenseKeyService } from './mock-license-key-service';
import { emailVerificationService } from './email-verification-service';

// Use mock service in development
const activeLicenseService = process.env.NODE_ENV === 'production' ? licenseKeyService : mockLicenseKeyService;

export class SubscriptionService {
  private db = getAdminFirestore();

  /**
   * Initialize user with default subscription fields
   */
  async initializeUserSubscription(userId: string, email: string, name: string): Promise<void> {
    const defaultSubscriptionFields: UserSubscriptionFields = {
      plan: 'free',
      planStatus: 'active',
      currentPeriodEnd: null,
      dodoCustomerId: null,
      dodoSubscriptionId: null,
      licenseKey: null,
      licenseKeyStatus: null,
      licenseKeyActivatedAt: null,
      emailVerified: false,
    };

    // Update user document with subscription fields
    await this.db.collection('users').doc(userId).set({
      ...defaultSubscriptionFields,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    // Initialize usage counters
    await this.initializeUsageCounters(userId, 'free');
  }

  /**
   * Initialize usage counters for a user
   */
  async initializeUsageCounters(userId: string, plan: PlanType): Promise<void> {
    const defaultCounters = DEFAULT_USAGE_LIMITS[plan];
    const batch = this.db.batch();

    // Create usage counters subcollection
    Object.entries(defaultCounters).forEach(([feature, counter]) => {
      const counterRef = this.db
        .collection('usage')
        .doc(userId)
        .collection('counters')
        .doc(feature);
      
      batch.set(counterRef, {
        ...counter,
        updatedAt: FieldValue.serverTimestamp()
      });
    });

    await batch.commit();
  }

  /**
   * Update user subscription information
   */
  async updateUserSubscription(
    userId: string, 
    updates: Partial<UserSubscriptionFields>
  ): Promise<void> {
    await this.db.collection('users').doc(userId).update({
      ...updates,
      updatedAt: FieldValue.serverTimestamp()
    });

    // If plan changed, update usage limits
    if (updates.plan) {
      await this.updateUsageLimits(userId, updates.plan);
    }
  }

  /**
   * Update usage limits when plan changes
   */
  async updateUsageLimits(userId: string, newPlan: PlanType): Promise<void> {
    const newLimits = DEFAULT_USAGE_LIMITS[newPlan];
    const batch = this.db.batch();

    Object.entries(newLimits).forEach(([feature, counter]) => {
      const counterRef = this.db
        .collection('usage')
        .doc(userId)
        .collection('counters')
        .doc(feature);
      
      // Keep current count, but update limit
      batch.update(counterRef, {
        limit: counter.limit,
        updatedAt: FieldValue.serverTimestamp()
      });
    });

    await batch.commit();
  }

  /**
   * Get user's current subscription info
   */
  async getUserSubscription(userId: string): Promise<UserSubscriptionFields | null> {
    const userDoc = await this.db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return null;
    }

    const userData = userDoc.data();
    return {
      plan: userData?.plan || 'free',
      planStatus: userData?.planStatus || 'active',
      currentPeriodEnd: userData?.currentPeriodEnd?.toDate() || null,
      dodoCustomerId: userData?.dodoCustomerId || null,
      dodoSubscriptionId: userData?.dodoSubscriptionId || null,
      licenseKey: userData?.licenseKey || null,
      licenseKeyStatus: userData?.licenseKeyStatus || null,
      licenseKeyActivatedAt: userData?.licenseKeyActivatedAt?.toDate() || null,
      emailVerified: userData?.emailVerified || false,
    };
  }

  /**
   * Get user's usage counters
   */
  async getUserUsage(userId: string): Promise<UserUsageCounters | null> {
    const countersSnapshot = await this.db
      .collection('usage')
      .doc(userId)
      .collection('counters')
      .get();

    if (countersSnapshot.empty) {
      return null;
    }

    const usage: Partial<UserUsageCounters> = {};
    
    countersSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const counter: UsageCounter = {
        count: data.count || 0,
        limit: data.limit || 0,
        updatedAt: data.updatedAt?.toDate() || new Date()
      };
      
      (usage as any)[doc.id] = counter;
    });

    return usage as UserUsageCounters;
  }

  /**
   * Increment usage counter for a feature
   */
  async incrementUsage(userId: string, feature: keyof UserUsageCounters): Promise<boolean> {
    const counterRef = this.db
      .collection('usage')
      .doc(userId)
      .collection('counters')
      .doc(feature);

    const counterDoc = await counterRef.get();
    
    if (!counterDoc.exists) {
      throw new Error(`Usage counter not found for feature: ${feature}`);
    }

    const currentData = counterDoc.data()!;
    const currentCount = currentData.count || 0;
    const limit = currentData.limit || 0;

    // Check if within limits (-1 means unlimited)
    if (limit !== -1 && currentCount >= limit) {
      return false; // Usage limit reached
    }

    // Increment counter
    await counterRef.update({
      count: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp()
    });

    return true;
  }

  /**
   * Check if user can use a feature
   */
  async canUseFeature(userId: string, feature: keyof UserUsageCounters): Promise<boolean> {
    const counterRef = this.db
      .collection('usage')
      .doc(userId)
      .collection('counters')
      .doc(feature);

    const counterDoc = await counterRef.get();
    
    if (!counterDoc.exists) {
      return false;
    }

    const data = counterDoc.data()!;
    const count = data.count || 0;
    const limit = data.limit || 0;

    // -1 means unlimited
    return limit === -1 || count < limit;
  }

  /**
   * Log subscription event
   */
  async logSubscriptionEvent(event: Omit<SubscriptionEvent, 'id' | 'timestamp'>): Promise<string> {
    const eventData = {
      ...event,
      timestamp: FieldValue.serverTimestamp(),
      processed: event.processed || false
    };

    const eventRef = await this.db.collection('subscription_events').add(eventData);
    return eventRef.id;
  }

  /**
   * Get subscription event by webhook event ID for idempotency checking
   */
  async getEventById(eventId: string): Promise<SubscriptionEvent | null> {
    const snapshot = await this.db
      .collection('subscription_events')
      .where('eventId', '==', eventId)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate() || new Date()
    } as SubscriptionEvent;
  }

  /**
   * Mark subscription event as processed
   */
  async markEventAsProcessed(eventId: string, error?: string): Promise<void> {
    const updateData: any = {
      processed: true,
      processedAt: FieldValue.serverTimestamp()
    };

    if (error) {
      updateData.error = error;
    }

    await this.db.collection('subscription_events').doc(eventId).update(updateData);
  }

  /**
   * Get unprocessed subscription events
   */
  async getUnprocessedEvents(limit: number = 100): Promise<SubscriptionEvent[]> {
    const snapshot = await this.db
      .collection('subscription_events')
      .where('processed', '==', false)
      .orderBy('timestamp', 'asc')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate() || new Date()
    })) as SubscriptionEvent[];
  }

  /**
   * Reset usage counters (for monthly reset, etc.)
   */
  async resetUsageCounters(userId: string): Promise<void> {
    const countersSnapshot = await this.db
      .collection('usage')
      .doc(userId)
      .collection('counters')
      .get();

    const batch = this.db.batch();

    countersSnapshot.docs.forEach(doc => {
      batch.update(doc.ref, {
        count: 0,
        updatedAt: FieldValue.serverTimestamp()
      });
    });

    await batch.commit();
  }

  /**
   * Enhanced user initialization with email verification
   */
  async initializeUserWithVerification(userId: string, email: string, name: string): Promise<void> {
    const defaultSubscriptionFields: UserSubscriptionFields = {
      plan: 'free',
      planStatus: 'active',
      currentPeriodEnd: null,
      dodoCustomerId: null,
      dodoSubscriptionId: null,
      licenseKey: null,
      licenseKeyStatus: null,
      licenseKeyActivatedAt: null,
      emailVerified: false
    };

    // Update user document with subscription fields
    await this.db.collection('users').doc(userId).set({
      ...defaultSubscriptionFields,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    // Initialize usage counters
    await this.initializeUsageCounters(userId, 'free');

    // Send email verification
    await emailVerificationService.sendVerificationEmail(userId, email, name);
  }

  /**
   * Check if user has premium access (via subscription or license key)
   */
  async hasPremiumAccess(userId: string, userEmail?: string): Promise<{
    hasPremium: boolean;
    source: 'subscription' | 'license_key' | 'allow_list' | null;
    details?: any;
  }> {
    try {
      // Check allow-list first (for staging/testing)
      if (userEmail) {
        const environment = process.env.NODE_ENV || 'production';
        const isInAllowList = await activeLicenseService.isInAllowList(userEmail, environment);
        if (isInAllowList) {
          return {
            hasPremium: true,
            source: 'allow_list',
            details: { environment }
          };
        }
      }

      // Get user subscription data
      const userDoc = await this.db.collection('users').doc(userId).get();
      if (!userDoc.exists) {
        return { hasPremium: false, source: null };
      }

      const userData = userDoc.data();

      // Check regular subscription
      if (userData?.plan === 'premium' && userData?.planStatus === 'active') {
        return {
          hasPremium: true,
          source: 'subscription',
          details: {
            plan: userData.plan,
            status: userData.planStatus,
            currentPeriodEnd: userData.currentPeriodEnd?.toDate()
          }
        };
      }

      // Check license key
      if (userData?.licenseKey && userData?.licenseKeyStatus === 'active') {
        const licenseValidation = await activeLicenseService.validateLicenseKey(userData.licenseKey);
        if (licenseValidation.valid) {
          return {
            hasPremium: true,
            source: 'license_key',
            details: {
              licenseKey: userData.licenseKey,
              activatedAt: userData.licenseKeyActivatedAt?.toDate()
            }
          };
        }
      }

      return { hasPremium: false, source: null };

    } catch (error) {
      console.error('Error checking premium access:', error);
      return { hasPremium: false, source: null };
    }
  }

  /**
   * Check if user can perform action (includes email verification check)
   */
  async canPerformAction(
    userId: string,
    feature: keyof UserUsageCounters,
    requireEmailVerification: boolean = true
  ): Promise<{
    canPerform: boolean;
    reason?: string;
    upgradeRequired?: boolean;
    emailVerificationRequired?: boolean;
  }> {
    try {
      // Check email verification if required
      if (requireEmailVerification) {
        const isEmailVerified = await emailVerificationService.isEmailVerified(userId);
        if (!isEmailVerified) {
          return {
            canPerform: false,
            reason: 'Email verification required before using premium features',
            emailVerificationRequired: true
          };
        }
      }

      // Get user data
      const userDoc = await this.db.collection('users').doc(userId).get();
      if (!userDoc.exists) {
        return {
          canPerform: false,
          reason: 'User not found'
        };
      }

      const userData = userDoc.data();

      // Check premium access
      const premiumAccess = await this.hasPremiumAccess(userId, userData?.email);
      if (premiumAccess.hasPremium) {
        return { canPerform: true };
      }

      // Check usage limits for free users
      const canUse = await this.canUseFeature(userId, feature);
      if (!canUse) {
        return {
          canPerform: false,
          reason: `You've reached your ${feature} limit for the free plan`,
          upgradeRequired: true
        };
      }

      return { canPerform: true };

    } catch (error) {
      console.error('Error checking if user can perform action:', error);
      return {
        canPerform: false,
        reason: 'Unable to verify access. Please try again.'
      };
    }
  }

  /**
   * Get comprehensive user subscription status
   */
  async getUserSubscriptionStatus(userId: string): Promise<{
    plan: PlanType;
    planStatus: PlanStatus;
    hasPremium: boolean;
    premiumSource: 'subscription' | 'license_key' | 'allow_list' | null;
    emailVerified: boolean;
    licenseKey?: string;
    licenseKeyStatus?: string;
    currentPeriodEnd?: Date;
    usage: UserUsageCounters | null;
  }> {
    try {
      const userDoc = await this.db.collection('users').doc(userId).get();
      
      if (!userDoc.exists) {
        // Return default for non-existent users
        return {
          plan: 'free',
          planStatus: 'active',
          hasPremium: false,
          premiumSource: null,
          emailVerified: false,
          usage: null
        };
      }

      const userData = userDoc.data();
      const emailVerified = userData?.emailVerified === true;
      
      // Check premium access
      const premiumAccess = await this.hasPremiumAccess(userId, userData?.email);
      
      // Get usage counters
      const usage = await this.getUserUsage(userId);

      return {
        plan: userData?.plan || 'free',
        planStatus: userData?.planStatus || 'active',
        hasPremium: premiumAccess.hasPremium,
        premiumSource: premiumAccess.source,
        emailVerified,
        licenseKey: userData?.licenseKey || undefined,
        licenseKeyStatus: userData?.licenseKeyStatus || undefined,
        currentPeriodEnd: userData?.currentPeriodEnd?.toDate() || undefined,
        usage
      };

    } catch (error) {
      console.error('Error getting user subscription status:', error);
      return {
        plan: 'free',
        planStatus: 'active',
        hasPremium: false,
        premiumSource: null,
        emailVerified: false,
        usage: null
      };
    }
  }
}

// Export singleton instance
export const subscriptionService = new SubscriptionService();
