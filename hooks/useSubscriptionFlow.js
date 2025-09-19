// hooks/useSubscriptionFlow.js

import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import SubscriptionData, { subscriptionUtils } from '@/lib/subscription-utils';

/**
 * Custom hook for managing subscription flow state and handlers
 * Handles plan selection, billing toggle, pricing calculations, and flow management
 */
export const useSubscriptionFlow = (initialPlanId = 'individual', initialBillingCycle = 'monthly') => {
  // Core subscription state
  const [subscriptionData, setSubscriptionData] = useState(
    () => new SubscriptionData(initialPlanId, initialBillingCycle)
  );
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState('selection'); // selection, payment, confirmation, success, error
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  
  // Analytics and tracking
  const [interactions, setInteractions] = useState({
    planChanges: 0,
    billingToggles: 0,
    startTime: Date.now()
  });

  // Plan selection handler
  const handlePlanSelection = useCallback((planId) => {
    try {
      const newSubscription = new SubscriptionData(planId, subscriptionData.billingCycle);
      setSubscriptionData(newSubscription);
      setError(null);
      setLastUpdate(Date.now());
      
      // Track interaction
      setInteractions(prev => ({
        ...prev,
        planChanges: prev.planChanges + 1
      }));

      // Show success feedback
      const plan = subscriptionUtils.getPlan(planId);
      toast.success('Plan Selected', {
        description: `${plan.name} plan selected successfully`,
        duration: 2000,
      });

      return true;
    } catch (error) {
      console.error('Error selecting plan:', error);
      setError(`Failed to select ${planId} plan`);
      
      toast.error('Selection Error', {
        description: 'Failed to select plan. Please try again.',
      });
      
      return false;
    }
  }, [subscriptionData.billingCycle]);

  // Billing cycle toggle handler
  const handleBillingToggle = useCallback((newBillingCycle) => {
    try {
      const previousSavings = subscriptionData.getFormattedYearlySavings();
      const success = subscriptionData.updateBillingCycle(newBillingCycle);
      
      if (success) {
        // Create new instance to trigger re-renders
        const newSubscription = new SubscriptionData(subscriptionData.planId, newBillingCycle);
        setSubscriptionData(newSubscription);
        setError(null);
        setLastUpdate(Date.now());
        
        // Track interaction
        setInteractions(prev => ({
          ...prev,
          billingToggles: prev.billingToggles + 1
        }));

        // Show billing cycle change feedback
        const newSavings = newSubscription.getFormattedYearlySavings();
        
        if (newBillingCycle === 'yearly' && newSavings) {
          toast.success('Yearly Billing Selected', {
            description: `Save ${newSavings} with yearly billing!`,
            duration: 3000,
          });
        } else if (newBillingCycle === 'monthly') {
          toast.info('Monthly Billing Selected', {
            description: 'Switched to monthly billing',
            duration: 2000,
          });
        }

        return true;
      } else {
        throw new Error('Invalid billing cycle');
      }
    } catch (error) {
      console.error('Error updating billing cycle:', error);
      setError('Failed to update billing cycle');
      
      toast.error('Billing Error', {
        description: 'Failed to update billing cycle. Please try again.',
      });
      
      return false;
    }
  }, [subscriptionData]);

  // Calculate pricing with animations/transitions
  const getPricingWithTransition = useCallback(() => {
    const summary = subscriptionData.getSummary();
    
    return {
      ...summary,
      // Add transition flags for UI animations
      hasYearlySavings: summary.yearlySavings !== null,
      savingsAmount: summary.yearlySavings,
      isYearly: subscriptionData.billingCycle === 'yearly',
      isPopular: subscriptionData.plan.popular,
      isRecommended: subscriptionData.plan.recommended,
      transitionKey: `${subscriptionData.planId}-${subscriptionData.billingCycle}-${lastUpdate}`
    };
  }, [subscriptionData, lastUpdate]);

  // Subscription success handler
  const handleSubscriptionSuccess = useCallback((paypalData, userInfo = {}) => {
    try {
      setIsLoading(false);
      setStep('success');
      setError(null);

      // Create subscription from PayPal response
      const successSubscription = SubscriptionData.fromPayPalResponse(paypalData);
      setSubscriptionData(successSubscription);

      // Show success message with plan details
      const summary = successSubscription.getSummary();
      
      toast.success('Subscription Activated!', {
        description: `Welcome to ${summary.planName}! Your subscription is now active.`,
        duration: 5000,
      });

      // Track successful conversion
      const conversionTime = Date.now() - interactions.startTime;
      console.log('Subscription conversion completed:', {
        planId: successSubscription.planId,
        billingCycle: successSubscription.billingCycle,
        conversionTime,
        interactions
      });

      return {
        success: true,
        subscription: successSubscription,
        summary: summary,
        conversionMetrics: {
          timeToConvert: conversionTime,
          planChanges: interactions.planChanges,
          billingToggles: interactions.billingToggles
        }
      };
    } catch (error) {
      console.error('Error handling subscription success:', error);
      setError('Failed to process successful subscription');
      setStep('error');
      return { success: false, error: error.message };
    }
  }, [interactions]);

  // Subscription failure handler
  const handleSubscriptionFailure = useCallback((error, context = {}) => {
    setIsLoading(false);
    setStep('error');
    
    const errorMessage = error?.message || 'Subscription failed';
    setError(errorMessage);

    // Show error with retry options
    toast.error('Subscription Failed', {
      description: errorMessage,
      duration: 8000,
      action: {
        label: 'Retry',
        onClick: () => {
          setStep('selection');
          setError(null);
        }
      }
    });

    // Log error for debugging
    console.error('Subscription failure:', {
      error: errorMessage,
      context,
      planId: subscriptionData.planId,
      billingCycle: subscriptionData.billingCycle,
      interactions
    });

    return {
      success: false,
      error: errorMessage,
      retryAvailable: true,
      supportContact: '/contact'
    };
  }, [subscriptionData, interactions]);

  // Reset flow to initial state
  const resetFlow = useCallback(() => {
    setSubscriptionData(new SubscriptionData(initialPlanId, initialBillingCycle));
    setIsLoading(false);
    setError(null);
    setStep('selection');
    setLastUpdate(Date.now());
    setInteractions({
      planChanges: 0,
      billingToggles: 0,
      startTime: Date.now()
    });
  }, [initialPlanId, initialBillingCycle]);

  // Start payment flow
  const startPayment = useCallback(() => {
    setStep('payment');
    setIsLoading(true);
    setError(null);
  }, []);

  // Cancel payment flow
  const cancelPayment = useCallback(() => {
    setStep('selection');
    setIsLoading(false);
    setError(null);
    
    toast.info('Payment Cancelled', {
      description: 'You can restart the subscription process anytime.',
      duration: 3000,
    });
  }, []);

  // Get subscription benefits for yearly plans
  const getYearlyBenefits = useCallback(() => {
    if (subscriptionData.billingCycle !== 'yearly') return null;

    const summary = subscriptionData.getSummary();
    const monthlyTotal = subscriptionData.plan.pricing.monthly.amount * 12;
    
    return {
      totalSavings: summary.yearlySavings,
      savingsPercentage: summary.savingsPercentage,
      monthsFree: summary.monthsFree,
      monthlyTotal: new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(monthlyTotal),
      yearlyTotal: summary.price,
      billingDate: subscriptionUtils.formatDate(summary.nextBillingDate),
      renewalDate: subscriptionUtils.formatDate(
        new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      )
    };
  }, [subscriptionData]);

  // Get current step information
  const getStepInfo = useCallback(() => {
    const stepInfo = {
      selection: {
        title: 'Choose Your Plan',
        description: 'Select the perfect plan for your needs',
        canProceed: true,
        nextStep: 'payment'
      },
      payment: {
        title: 'Complete Payment',
        description: 'Secure payment processing via PayPal',
        canProceed: false,
        nextStep: 'confirmation'
      },
      confirmation: {
        title: 'Confirm Subscription',
        description: 'Review your subscription details',
        canProceed: true,
        nextStep: 'success'
      },
      success: {
        title: 'Subscription Active',
        description: 'Welcome to PrepBettr! Your subscription is ready.',
        canProceed: false,
        nextStep: null
      },
      error: {
        title: 'Subscription Error',
        description: 'Something went wrong. Let\'s get this fixed.',
        canProceed: true,
        nextStep: 'selection'
      }
    };

    return stepInfo[step] || stepInfo.selection;
  }, [step]);

  // Effect for auto-saving state to localStorage
  useEffect(() => {
    try {
      const stateToSave = {
        planId: subscriptionData.planId,
        billingCycle: subscriptionData.billingCycle,
        step,
        interactions,
        timestamp: Date.now()
      };
      
      localStorage.setItem('prepbettr_subscription_flow', JSON.stringify(stateToSave));
    } catch (error) {
      // Ignore localStorage errors
      console.warn('Failed to save subscription flow to localStorage:', error);
    }
  }, [subscriptionData, step, interactions]);

  // Effect for loading state from localStorage on mount
  useEffect(() => {
    try {
      const savedState = localStorage.getItem('prepbettr_subscription_flow');
      if (savedState) {
        const parsed = JSON.parse(savedState);
        
        // Only restore if less than 1 hour old
        if (Date.now() - parsed.timestamp < 60 * 60 * 1000) {
          setSubscriptionData(new SubscriptionData(parsed.planId, parsed.billingCycle));
          setStep(parsed.step === 'payment' ? 'selection' : parsed.step); // Reset payment step
          setInteractions(parsed.interactions);
        }
      }
    } catch (error) {
      // Ignore localStorage errors
      console.warn('Failed to load subscription flow from localStorage:', error);
    }
  }, []);

  return {
    // Core state
    subscriptionData,
    isLoading,
    error,
    step,
    
    // Handlers
    handlePlanSelection,
    handleBillingToggle,
    handleSubscriptionSuccess,
    handleSubscriptionFailure,
    startPayment,
    cancelPayment,
    resetFlow,
    
    // Computed values
    pricing: getPricingWithTransition(),
    yearlyBenefits: getYearlyBenefits(),
    stepInfo: getStepInfo(),
    
    // Utils
    setStep,
    setIsLoading,
    setError,
    
    // Analytics
    interactions
  };
};

export default useSubscriptionFlow;
