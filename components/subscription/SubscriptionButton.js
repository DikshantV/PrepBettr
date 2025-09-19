'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CreditCard, Shield, Star, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import PayPalSubscriptionButton from '@/components/PayPalSubscriptionButton';
import { pricingUtils } from '@/lib/pricing-config';

/**
 * SubscriptionButton - Reusable component for subscription payment buttons
 * Integrates with PayPal and handles subscription creation flow
 * 
 * @param {Object} props
 * @param {string} props.planId - Plan identifier
 * @param {string} props.planType - Plan type (individual/enterprise)
 * @param {string} props.billingCycle - Billing cycle (monthly/yearly)
 * @param {number} props.price - Plan price
 * @param {string} props.userEmail - User email for subscription
 * @param {string} props.userName - User name for subscription
 * @param {Function} props.onSuccess - Success callback
 * @param {Function} props.onError - Error callback
 * @param {string} props.variant - Button variant
 * @param {string} props.size - Button size
 * @param {boolean} props.showTrialInfo - Show trial information
 * @param {boolean} props.showSavings - Show savings information
 * @param {string} props.className - Additional CSS classes
 */
const SubscriptionButton = ({
  planId,
  planType,
  planName,
  billingCycle = 'monthly',
  price,
  userEmail,
  userName,
  onSuccess = () => {},
  onError = () => {},
  variant = 'default',
  size = 'default',
  showTrialInfo = true,
  showSavings = true,
  showSecurityBadge = true,
  disabled = false,
  className = '',
  customText = null,
  loadingText = 'Processing...',
  successText = 'Subscription Active!',
  buttonType = 'paypal' // 'paypal', 'card', 'both'
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);

  // Handle subscription success
  const handleSubscriptionSuccess = (subscriptionData) => {
    setIsProcessing(false);
    setSubscriptionStatus('success');
    
    // Reset status after 3 seconds
    setTimeout(() => {
      setSubscriptionStatus(null);
    }, 3000);

    onSuccess(subscriptionData, planType);
  };

  // Handle subscription error
  const handleSubscriptionError = (error) => {
    setIsProcessing(false);
    setSubscriptionStatus('error');
    
    // Reset status after 5 seconds
    setTimeout(() => {
      setSubscriptionStatus(null);
    }, 5000);

    onError(error, planType);
  };

  // Handle subscription start (when PayPal opens)
  const handleSubscriptionStart = () => {
    setIsProcessing(true);
    setSubscriptionStatus('processing');
  };

  // Calculate savings for yearly plans
  const getSavingsInfo = () => {
    if (!showSavings || billingCycle !== 'yearly') return null;
    
    const yearlyPrice = price * 12;
    const actualPrice = price * 10; // 2 months free
    const savings = yearlyPrice - actualPrice;
    
    return {
      amount: pricingUtils.formatPrice(savings),
      percentage: Math.round((savings / yearlyPrice) * 100)
    };
  };

  const savings = getSavingsInfo();

  // Button text logic
  const getButtonText = () => {
    if (subscriptionStatus === 'success') return successText;
    if (subscriptionStatus === 'processing' || isProcessing) return loadingText;
    if (subscriptionStatus === 'error') return 'Try Again';
    if (customText) return customText;
    
    const trialText = showTrialInfo ? 'Start 7-Day Free Trial' : 'Subscribe Now';
    const cycleText = billingCycle === 'yearly' ? 'Yearly' : 'Monthly';
    
    return `${trialText} - ${cycleText}`;
  };

  // Button variant based on status
  const getButtonVariant = () => {
    if (subscriptionStatus === 'success') return 'default';
    if (subscriptionStatus === 'error') return 'destructive';
    return variant;
  };

  // Size configurations for different elements
  const sizeConfig = {
    sm: {
      button: 'h-9 px-3 text-sm',
      badge: 'text-xs px-2 py-1',
      icon: 'h-3 w-3'
    },
    default: {
      button: 'h-10 px-4 py-2',
      badge: 'text-xs px-2 py-1',
      icon: 'h-4 w-4'
    },
    lg: {
      button: 'h-12 px-6 py-3 text-lg',
      badge: 'text-sm px-3 py-1.5',
      icon: 'h-5 w-5'
    }
  };

  const currentSizeConfig = sizeConfig[size] || sizeConfig.default;

  // PayPal Button Component
  if (buttonType === 'paypal' || buttonType === 'both') {
    return (
      <div className={cn('space-y-3', className)}>
        {/* Savings Badge */}
        {savings && (
          <div className="text-center">
            <Badge className="bg-green-900/20 text-green-400 border-green-500/30 animate-pulse">
              <Star className={cn('mr-1', currentSizeConfig.icon)} />
              Save {savings.amount} ({savings.percentage}%) yearly
            </Badge>
          </div>
        )}

        {/* PayPal Subscription Button */}
        <div className="relative">
          <PayPalSubscriptionButton
            planId={planId}
            planType={planType}
            planName={planName}
            price={price}
            billingCycle={billingCycle}
            userEmail={userEmail}
            userName={userName}
            onSuccess={handleSubscriptionSuccess}
            onError={handleSubscriptionError}
            onStart={handleSubscriptionStart}
            disabled={disabled || isProcessing}
            className={cn('w-full', currentSizeConfig.button)}
            variant={getButtonVariant()}
            size={size}
          />
          
          {/* Loading Overlay */}
          {isProcessing && (
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm rounded-md flex items-center justify-center">
              <div className="flex items-center space-x-2 text-white">
                <Loader2 className={cn('animate-spin', currentSizeConfig.icon)} />
                <span className="text-sm">{loadingText}</span>
              </div>
            </div>
          )}
        </div>

        {/* Trial Information */}
        {showTrialInfo && (
          <div className="text-center">
            <p className="text-xs text-gray-400 flex items-center justify-center">
              <Shield className={cn('mr-1', currentSizeConfig.icon)} />
              7-day free trial • Cancel anytime
            </p>
          </div>
        )}

        {/* Security Badge */}
        {showSecurityBadge && (
          <div className="flex items-center justify-center space-x-4 text-xs text-gray-500">
            <div className="flex items-center">
              <Shield className={cn('mr-1', currentSizeConfig.icon)} />
              <span>Secure</span>
            </div>
            <div className="flex items-center">
              <CreditCard className={cn('mr-1', currentSizeConfig.icon)} />
              <span>PayPal Protected</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className={cn('mr-1', currentSizeConfig.icon)} />
              <span>SSL Encrypted</span>
            </div>
          </div>
        )}

        {/* Status Messages */}
        {subscriptionStatus === 'success' && (
          <div className="text-center p-3 bg-green-900/20 border border-green-500/30 rounded-md">
            <p className="text-green-400 text-sm flex items-center justify-center">
              <CheckCircle className={cn('mr-2', currentSizeConfig.icon)} />
              Subscription activated successfully!
            </p>
          </div>
        )}

        {subscriptionStatus === 'error' && (
          <div className="text-center p-3 bg-red-900/20 border border-red-500/30 rounded-md">
            <p className="text-red-400 text-sm">
              Something went wrong. Please try again or contact support.
            </p>
          </div>
        )}
      </div>
    );
  }

  // Fallback Button for non-PayPal integrations
  return (
    <div className={cn('space-y-3', className)}>
      {/* Savings Badge */}
      {savings && (
        <div className="text-center">
          <Badge className="bg-green-900/20 text-green-400 border-green-500/30">
            <Star className={cn('mr-1', currentSizeConfig.icon)} />
            Save {savings.amount} ({savings.percentage}%) yearly
          </Badge>
        </div>
      )}

      {/* Main Button */}
      <Button
        onClick={() => {
          // Handle non-PayPal subscription creation
          handleSubscriptionStart();
          // Add your custom subscription logic here
        }}
        disabled={disabled || isProcessing}
        variant={getButtonVariant()}
        size={size}
        className={cn('w-full', currentSizeConfig.button, className)}
      >
        {isProcessing ? (
          <>
            <Loader2 className={cn('mr-2 animate-spin', currentSizeConfig.icon)} />
            {loadingText}
          </>
        ) : subscriptionStatus === 'success' ? (
          <>
            <CheckCircle className={cn('mr-2', currentSizeConfig.icon)} />
            {successText}
          </>
        ) : (
          <>
            <CreditCard className={cn('mr-2', currentSizeConfig.icon)} />
            {getButtonText()}
          </>
        )}
      </Button>

      {/* Security and Trial Info */}
      <div className="space-y-2">
        {showTrialInfo && (
          <p className="text-center text-xs text-gray-400 flex items-center justify-center">
            <Shield className={cn('mr-1', currentSizeConfig.icon)} />
            7-day free trial • Cancel anytime
          </p>
        )}

        {showSecurityBadge && (
          <div className="flex items-center justify-center space-x-4 text-xs text-gray-500">
            <span>🔒 Secure Payment</span>
            <span>⚡ Instant Activation</span>
            <span>✅ Money-back Guarantee</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubscriptionButton;

// Export for easier composition
export { SubscriptionButton };