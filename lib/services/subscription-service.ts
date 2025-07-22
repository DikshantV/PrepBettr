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
}

// Export singleton instance
export const subscriptionService = new SubscriptionService();
