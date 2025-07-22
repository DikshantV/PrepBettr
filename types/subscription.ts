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
    resumeTailor: { count: 0, limit: 2, updatedAt: new Date() },
    autoApply: { count: 0, limit: 1, updatedAt: new Date() },
  },
  premium: {
    interviews: { count: 0, limit: -1, updatedAt: new Date() }, // -1 = unlimited
    resumeTailor: { count: 0, limit: -1, updatedAt: new Date() },
    autoApply: { count: 0, limit: -1, updatedAt: new Date() },
  },
};

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
}
