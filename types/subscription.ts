// types/subscription.ts

export interface EmailVerification {
  id: string;
  userId: string;
  email: string;
  token: string;
  verified: boolean;
  createdAt: Date;
  verifiedAt: Date | null;
  expiresAt: Date;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  features: string[];
  limits: {
    resumeProcessing: number;
    interviewSessions: number;
    coverLetters: number;
  };
}

export interface UserSubscription {
  id: string;
  userId: string;
  planId: string;
  status: 'active' | 'canceled' | 'expired' | 'past_due';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UsageTracking {
  id: string;
  userId: string;
  subscriptionId: string;
  resumeProcessingCount: number;
  interviewSessionsCount: number;
  coverLettersCount: number;
  resetDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

// PayPal-specific subscription types
export interface PayPalSubscriptionDetails {
  paypalSubscriptionId: string;
  paypalPlanId: string;
  paypalStatus: 'APPROVAL_PENDING' | 'APPROVED' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED' | 'EXPIRED';
  paypalCustomerId?: string;
  nextBillingTime?: Date;
  lastPaymentAmount?: number;
  lastPaymentTime?: Date;
  failedPaymentCount?: number;
}

// Enhanced subscription interface with PayPal support
export interface EnhancedUserSubscription extends UserSubscription {
  paypalDetails?: PayPalSubscriptionDetails;
  provider: 'stripe' | 'paypal';
}

// Subscription creation request
export interface CreateSubscriptionRequest {
  planId: string;
  provider: 'stripe' | 'paypal';
  userEmail: string;
  userName?: string;
  returnUrl: string;
  cancelUrl: string;
}

// Subscription management operations
export interface SubscriptionOperation {
  subscriptionId: string;
  operation: 'cancel' | 'suspend' | 'activate' | 'update';
  reason?: string;
  effectiveDate?: Date;
}

// Billing event for tracking payments
export interface BillingEvent {
  id: string;
  subscriptionId: string;
  eventType: 'payment_success' | 'payment_failed' | 'subscription_created' | 'subscription_cancelled' | 'subscription_renewed';
  amount?: number;
  currency?: string;
  eventDate: Date;
  paymentProvider: 'stripe' | 'paypal';
  providerEventId?: string;
  metadata?: Record<string, any>;
}
