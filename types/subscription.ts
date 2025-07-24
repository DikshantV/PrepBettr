// types/subscription.ts

export type PlanType = 'free' | 'premium';
export type PlanStatus = 'active' | 'canceled' | 'past_due' | 'incomplete' | 'trialing';

// Extended User document fields
export interface UserSubscriptionFields {
  plan: PlanType;
  planStatus: PlanStatus;
  currentPeriodEnd: Date | null;
  dodoCustomerId: string | null;
  dodoSubscriptionId: string | null;
  // License key fields
  licenseKey: string | null;
  licenseKeyStatus: 'active' | 'inactive' | 'expired' | null;
  licenseKeyActivatedAt: Date | null;
  emailVerified: boolean;
}

// Usage counter document structure
export interface UsageCounter {
  count: number;
  limit: number;
  updatedAt: Date;
}

// Usage counters for different features
export interface UserUsageCounters {
  interviews: UsageCounter;
  resumeTailor: UsageCounter;
  autoApply: UsageCounter;
}

// Subscription event log entry
export interface SubscriptionEvent {
  id: string;
  eventId: string; // Webhook event ID for idempotency
  userId: string;
  eventType: string;
  timestamp: Date;
  rawWebhookData: Record<string, any>; // Raw JSON from webhook
  parsedData: {
    customerId?: string;
    subscriptionId?: string;
    plan?: PlanType;
    status?: PlanStatus;
    currentPeriodEnd?: Date;
    amount?: number;
    currency?: string;
    previousPlan?: PlanType;
    error?: string;
  };
  processed: boolean;
  error?: string;
}

// Default usage limits by plan
export const DEFAULT_USAGE_LIMITS: Record<PlanType, UserUsageCounters> = {
  free: {
    interviews: { count: 0, limit: 3, updatedAt: new Date() },
    resumeTailor: { count: 0, limit: 3, updatedAt: new Date() },
    autoApply: { count: 0, limit: 3, updatedAt: new Date() },
  },
  premium: {
    interviews: { count: 0, limit: -1, updatedAt: new Date() }, // -1 = unlimited
    resumeTailor: { count: 0, limit: -1, updatedAt: new Date() },
    autoApply: { count: 0, limit: -1, updatedAt: new Date() },
  },
};

// License key interface
export interface LicenseKey {
  id: string;
  key: string;
  userId: string;
  status: 'active' | 'inactive' | 'expired';
  activatedAt: Date | null;
  expiresAt: Date | null;
  activationLimit: number;
  activationCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// Email verification interface
export interface EmailVerification {
  userId: string;
  email: string;
  token: string;
  verified: boolean;
  createdAt: Date;
  verifiedAt: Date | null;
  expiresAt: Date;
}

// Allow-list for free premium access
export interface AllowListEntry {
  email: string;
  userId?: string;
  environment: 'staging' | 'production' | 'all';
  reason: string;
  createdAt: Date;
  active: boolean;
}

// Complete user document with subscription fields
export interface ExtendedUser {
  uid: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
  
  // Profile fields
  about?: string;
  phone?: string;
  workplace?: string;
  skills?: string[];
  experience?: string;
  dateOfBirth?: string;
  image?: string;
  
  // New subscription fields
  plan: PlanType;
  planStatus: PlanStatus;
  currentPeriodEnd: Date | null;
  dodoCustomerId: string | null;
  dodoSubscriptionId: string | null;
  // License key fields
  licenseKey: string | null;
  licenseKeyStatus: 'active' | 'inactive' | 'expired' | null;
  licenseKeyActivatedAt: Date | null;
  emailVerified: boolean;
}
