// components/subscription/index.js

/**
 * PrepBettr Subscription Components
 * 
 * Barrel export file for all subscription-related components
 * Import any or all components using:
 * 
 * import { PlanSelector, PricingToggle, SubscriptionButton, SubscriptionStatus } from '@/components/subscription';
 * 
 * Or import individually:
 * import { PlanSelector } from '@/components/subscription';
 */

// Core subscription components
export { default as PlanSelector, PlanSelector } from './PlanSelector';
export { default as SubscriptionButton, SubscriptionButton } from './SubscriptionButton';
export { default as PricingToggle, PricingToggle } from './PricingToggle';
export { default as SubscriptionStatus, SubscriptionStatus } from './SubscriptionStatus';

// Re-export pricing configuration for convenience
export { 
  PREPBETTR_PRICING,
  PREPBETTR_PLANS,
  pricingUtils
} from '../lib/pricing-config';

// Export types for TypeScript users
export type {
  PrepBettrPlan,
  PrepBettrPricing,
  SubscriptionData,
  PlanSelectorProps,
  SubscriptionButtonProps,
  PricingToggleProps,
  SubscriptionStatusProps
} from './types';

/**
 * Component Usage Examples:
 * 
 * // Basic plan selector
 * <PlanSelector
 *   plans={allPlans}
 *   selectedPlan={selectedPlan}
 *   onPlanSelect={setSelectedPlan}
 *   isYearly={isYearly}
 * />
 * 
 * // Pricing toggle with savings
 * <PricingToggle
 *   isYearly={isYearly}
 *   onToggle={setIsYearly}
 *   savingsPercentage={17}
 * />
 * 
 * // PayPal subscription button
 * <SubscriptionButton
 *   planId="individual-monthly"
 *   planType="individual"
 *   price={49}
 *   userEmail={user.email}
 *   userName={user.name}
 *   onSuccess={handleSuccess}
 *   onError={handleError}
 * />
 * 
 * // User subscription status
 * <SubscriptionStatus
 *   subscription={userSubscription}
 *   userUsage={currentUsage}
 *   variant="full"
 *   onPlanChange={handlePlanChange}
 * />
 */