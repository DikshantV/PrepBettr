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
