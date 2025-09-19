// types/paypal.ts

export interface PayPalSubscriptionPlan {
  id: string;
  name: string;
  description: string;
  type: 'INDIVIDUAL' | 'ENTERPRISE';
  billing_cycle: 'MONTHLY' | 'YEARLY';
  price: number;
  currency: string;
  interval: 'MONTH' | 'YEAR';
  interval_count: number;
  trial_period?: {
    duration: number;
    unit: 'DAY' | 'WEEK' | 'MONTH';
  };
  features: string[];
  limits: {
    resumeProcessing: number;
    interviewSessions: number;
    coverLetters: number;
  };
}

export interface PayPalBillingCycle {
  frequency: {
    interval_unit: 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';
    interval_count: number;
  };
  tenure_type: 'TRIAL' | 'REGULAR';
  sequence: number;
  total_cycles: number;
  pricing_scheme: {
    fixed_price: {
      value: string;
      currency_code: string;
    };
  };
}

export interface PayPalPlanDetails {
  product_id: string;
  name: string;
  description: string;
  status: 'CREATED' | 'ACTIVE' | 'INACTIVE';
  billing_cycles: PayPalBillingCycle[];
  payment_preferences: {
    auto_bill_outstanding: boolean;
    setup_fee?: {
      value: string;
      currency_code: string;
    };
    setup_fee_failure_action: 'CONTINUE' | 'CANCEL';
    payment_failure_threshold: number;
  };
  taxes?: {
    percentage: string;
    inclusive: boolean;
  };
}

export interface PayPalSubscription {
  id: string;
  plan_id: string;
  start_time?: string;
  quantity?: string;
  shipping_amount?: {
    currency_code: string;
    value: string;
  };
  subscriber: {
    name?: {
      given_name: string;
      surname: string;
    };
    email_address: string;
    payer_id?: string;
  };
  application_context?: {
    brand_name?: string;
    locale?: string;
    shipping_preference?: 'GET_FROM_FILE' | 'NO_SHIPPING' | 'SET_PROVIDED_ADDRESS';
    user_action?: 'SUBSCRIBE_NOW' | 'CONTINUE';
    payment_method?: {
      payer_selected?: string;
      payee_preferred?: 'UNRESTRICTED' | 'IMMEDIATE_PAYMENT_REQUIRED';
    };
    return_url: string;
    cancel_url: string;
  };
  status: 'APPROVAL_PENDING' | 'APPROVED' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED' | 'EXPIRED';
  status_update_time?: string;
  create_time?: string;
  update_time?: string;
  links?: Array<{
    href: string;
    rel: string;
    method: string;
  }>;
}

export interface PayPalWebhookEvent {
  id: string;
  event_version: string;
  create_time: string;
  resource_type: string;
  resource_version: string;
  event_type: string;
  summary: string;
  resource: PayPalSubscription;
  links?: Array<{
    href: string;
    rel: string;
    method: string;
  }>;
}

export interface PayPalError {
  error?: string;
  error_description?: string;
  details?: Array<{
    issue: string;
    description: string;
    location?: string;
    field?: string;
    value?: string;
  }>;
  debug_id?: string;
  information_link?: string;
}

export interface PayPalCreateSubscriptionRequest {
  plan_id: string;
  start_time?: string;
  quantity?: string;
  subscriber: {
    name?: {
      given_name: string;
      surname: string;
    };
    email_address: string;
  };
  application_context: {
    brand_name: string;
    locale: string;
    shipping_preference: 'NO_SHIPPING';
    user_action: 'SUBSCRIBE_NOW';
    payment_method: {
      payer_selected: 'PAYPAL';
      payee_preferred: 'IMMEDIATE_PAYMENT_REQUIRED';
    };
    return_url: string;
    cancel_url: string;
  };
}

export interface PayPalCreateSubscriptionResponse {
  id: string;
  status: string;
  links: Array<{
    href: string;
    rel: string;
    method: string;
  }>;
}
