'use client';

import React, { useState, useEffect } from 'react';
import { PayPalScriptProvider } from '@paypal/react-paypal-js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle, 
  Zap, 
  Building2, 
  Crown, 
  Sparkles, 
  Shield, 
  Star, 
  Users,
  Clock,
  Headphones,
  BarChart3,
  Settings,
  Lock,
  Award,
  ChevronDown,
  ChevronUp,
  Info,
  TrendingUp,
  Calendar,
  CreditCard
} from 'lucide-react';
import { cn } from '@/lib/utils';
import PayPalSubscriptionButton from './PayPalSubscriptionButton';
import SubscriptionConfirmation from './SubscriptionConfirmation';
import useSubscriptionFlow from '../hooks/useSubscriptionFlow';
import { subscriptionUtils, SUBSCRIPTION_PLANS } from '@/lib/subscription-utils';
import { toast } from 'sonner';

const EnhancedSubscriptionCheckout = ({ 
  userEmail, 
  userName,
  className = "",
  onSubscriptionSuccess,
  onSubscriptionError,
  initialPlanId = 'individual',
  initialBillingCycle = 'monthly'
}) => {
  const [showMobileComparison, setShowMobileComparison] = useState(false);

  // Use subscription flow hook
  const {
    subscriptionData,
    isLoading,
    error,
    step,
    handlePlanSelection,
    handleBillingToggle,
    handleSubscriptionSuccess: handleFlowSuccess,
    handleSubscriptionFailure: handleFlowFailure,
    startPayment,
    resetFlow,
    pricing,
    yearlyBenefits,
    stepInfo
  } = useSubscriptionFlow(initialPlanId, initialBillingCycle);

  // Enhanced success handler that combines flow and parent handlers
  const handleSubscriptionSuccessEnhanced = async (paypalData, planType) => {
    try {
      // Handle success in the flow
      const flowResult = handleFlowSuccess(paypalData, { planType, userEmail, userName });
      
      // Call parent success handler if provided
      if (onSubscriptionSuccess) {
        await onSubscriptionSuccess(paypalData, planType);
      }

      return flowResult;
    } catch (error) {
      console.error('Enhanced subscription success handler error:', error);
      handleFlowFailure(error, { planType, userEmail });
    }
  };

  // Enhanced error handler
  const handleSubscriptionErrorEnhanced = (error, planType) => {
    // Handle error in the flow
    const flowResult = handleFlowFailure(error, { planType, userEmail });
    
    // Call parent error handler if provided  
    if (onSubscriptionError) {
      onSubscriptionError(error, planType);
    }

    return flowResult;
  };

  // Get available plans with enhanced data
  const getAvailablePlans = () => {
    return Object.entries(SUBSCRIPTION_PLANS).map(([planKey, plan]) => ({
      ...plan,
      key: planKey,
      isSelected: subscriptionData.planId === planKey,
      currentPricing: subscriptionData.billingCycle === 'yearly' ? plan.pricing.yearly : plan.pricing.monthly
    }));
  };

  const StepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      <div className="flex items-center space-x-4">
        {['selection', 'payment', 'success'].map((stepName, index) => (
          <div key={stepName} className="flex items-center">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold",
              step === stepName ? "bg-primary-200 text-dark-100" : 
              ['payment', 'success'].includes(stepName) && step === 'success' ? "bg-success-100 text-dark-100" :
              "bg-gray-700 text-gray-400"
            )}>
              {step === 'success' && stepName !== 'selection' ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                index + 1
              )}
            </div>
            {index < 2 && (
              <div className={cn(
                "w-8 h-0.5 mx-2",
                step === 'success' ? "bg-success-100" :
                step === 'payment' && stepName === 'selection' ? "bg-primary-200" :
                "bg-gray-700"
              )} />
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const PlanComparisonTable = () => (
    <div className="w-full overflow-hidden">
      <div className="bg-dark-200/50 rounded-2xl p-6 backdrop-blur-sm">
        <h3 className="text-2xl font-bold text-white text-center mb-8">
          Compare Plans
        </h3>
        
        <div className="md:hidden mb-6">
          <button
            onClick={() => setShowMobileComparison(!showMobileComparison)}
            className="flex items-center justify-between w-full p-4 bg-dark-300/50 rounded-xl text-white hover:bg-dark-300/70 transition-colors"
          >
            <span className="font-medium">View Feature Comparison</span>
            {showMobileComparison ? <ChevronUp /> : <ChevronDown />}
          </button>
        </div>

        <div className={cn(
          "transition-all duration-300",
          showMobileComparison || "max-md:hidden"
        )}>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-4">
              <div className="h-20 flex items-end">
                <h4 className="font-semibold text-primary-200 text-lg">Features</h4>
              </div>
              {SUBSCRIPTION_PLANS.individual.features.map((feature, index) => (
                <div key={index} className="flex items-center h-12 text-sm text-gray-300">
                  <Star className="w-4 h-4 mr-2" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>

            {getAvailablePlans().map((plan) => (
              <div key={plan.key} className="space-y-4">
                <div className={cn(
                  "rounded-xl p-4 h-20 flex flex-col justify-center relative",
                  plan.popular ? "bg-primary-200/10 border border-primary-200/30" : "bg-dark-300/30"
                )}>
                  {plan.popular && (
                    <Badge className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-primary-200 text-dark-100 text-xs">
                      Most Popular
                    </Badge>
                  )}
                  <h4 className="font-bold text-white text-center">{plan.name}</h4>
                  <p className="text-primary-200 text-center text-sm">
                    {pricing.isYearly ? pricing.monthlyEquivalent : pricing.price}
                    {plan.key === pricing.planId ? '' : `/${subscriptionData.billingCycle === 'yearly' ? plan.pricing.yearly.monthlyEquivalent : plan.pricing.monthly.amount}`}/mo
                  </p>
                </div>
                {plan.features.map((_, index) => (
                  <div key={index} className="flex items-center justify-center h-12">
                    <CheckCircle className="w-5 h-5 text-success-100" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const PlanCard = ({ plan }) => {
    const isSelected = plan.isSelected;
    const isPopular = plan.popular;

    return (
      <Card 
        className={cn(
          "relative overflow-hidden transition-all duration-300 cursor-pointer group plan-card",
          isSelected ? "selected border-primary-200/80 ring-2 ring-primary-200/50" : "border-gray-700/50 hover:border-primary-200/30",
          isPopular && "popular ring-2 ring-primary-200/30",
          className
        )}
        onClick={() => handlePlanSelection(plan.key)}
      >
        {isPopular && (
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
            <Badge className="bg-primary-200 text-dark-100 px-4 py-2 font-bold text-sm">
              <Crown className="w-4 h-4 mr-2" />
              Most Popular
            </Badge>
          </div>
        )}

        {plan.recommended && (
          <div className="absolute top-4 right-4 z-10">
            <div className="bg-success-100/20 border border-success-100/50 rounded-full px-3 py-1">
              <span className="text-success-100 text-xs font-semibold">Recommended</span>
            </div>
          </div>
        )}

        <CardHeader className="text-center pb-4 pt-8">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-2xl bg-primary-200/10">
              {plan.key === 'individual' ? <Zap className="h-8 w-8 text-primary-200" /> : <Building2 className="h-8 w-8 text-primary-200" />}
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-white mb-2">
            {plan.name}
          </CardTitle>
          <CardDescription className="text-gray-400 text-base">
            {plan.description}
          </CardDescription>
        </CardHeader>

        <CardContent className="px-6 pb-8">
          <div className="text-center mb-8 p-6 bg-dark-300/30 rounded-2xl price-display">
            <div className="flex items-baseline justify-center mb-3">
              <span className="text-5xl font-bold text-white">
                {isSelected ? pricing.monthlyEquivalent : 
                 (subscriptionData.billingCycle === 'yearly' ? 
                  `$${plan.pricing.yearly.monthlyEquivalent}` : 
                  `$${plan.pricing.monthly.amount}`)}
              </span>
              <span className="text-gray-400 ml-2 text-lg">
                /month
              </span>
            </div>
            
            {subscriptionData.billingCycle === 'yearly' && (
              <div className="space-y-2">
                <p className="text-sm text-gray-400">
                  Billed ${isSelected ? pricing.price.replace('$', '') : 
                    (plan.key === subscriptionData.planId ? pricing.price.replace('$', '') : plan.pricing.yearly.amount)
                  } annually
                </p>
                <div className="flex items-center justify-center">
                  <Badge variant="outline" className="bg-success-100/20 text-success-100 border-success-100/50 savings-badge">
                    <Sparkles className="w-3 h-3 mr-1" />
                    Save {plan.pricing.yearly.savings}% yearly
                  </Badge>
                </div>
                <p className="text-xs text-success-100 font-semibold">
                  Save ${(plan.pricing.monthly.amount * 12) - plan.pricing.yearly.amount} per year!
                </p>
              </div>
            )}

            <div className="mt-4 text-center">
              <p className="text-xs text-gray-500">
                {subscriptionData.plan.trial.duration}-day free trial included
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold text-white text-lg mb-4">What's included:</h4>
            {plan.features.slice(0, 6).map((feature, index) => (
              <div key={index} className="flex items-start group/feature feature-item">
                <div className="text-success-100 mr-3 mt-0.5 shrink-0">
                  <Star className="w-4 h-4" />
                </div>
                <span className="text-gray-300 text-sm leading-relaxed group-hover/feature:text-white transition-colors">
                  {feature}
                </span>
              </div>
            ))}
            
            {plan.features.length > 6 && (
              <div className="text-center pt-2">
                <p className="text-primary-200 text-sm font-medium">
                  + {plan.features.length - 6} more features
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const SelectedPlanSummary = () => {
    const benefits = yearlyBenefits;
    
    return (
      <div className="bg-dark-200/50 rounded-2xl p-6 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white">Order Summary</h3>
          <Badge className="bg-primary-200/20 text-primary-200 border-primary-200/30">
            Selected Plan
          </Badge>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-dark-300/50 rounded-xl">
            <div className="flex items-center space-x-3">
              {subscriptionData.planId === 'individual' ? 
                <Zap className="h-6 w-6 text-primary-200" /> : 
                <Building2 className="h-6 w-6 text-primary-200" />
              }
              <div>
                <h4 className="font-semibold text-white">
                  {pricing.planName}
                </h4>
                <p className="text-sm text-gray-400">
                  {pricing.isYearly ? 'Billed annually' : 'Billed monthly'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-bold text-white text-lg">
                {pricing.monthlyEquivalent}
                <span className="text-sm text-gray-400 font-normal">/mo</span>
              </p>
              {pricing.hasYearlySavings && (
                <p className="text-xs text-success-100">
                  Save {pricing.savingsPercentage}%
                </p>
              )}
            </div>
          </div>

          {benefits && (
            <div className="bg-success-100/5 border border-success-100/20 rounded-xl p-4">
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <div className="text-sm text-gray-300">Total billed today:</div>
                  <div className="font-semibold text-white">$0.00</div>
                </div>
                <div>
                  <div className="text-sm text-gray-300">Next billing:</div>
                  <div className="font-semibold text-white">{pricing.price}</div>
                </div>
              </div>
              <div className="text-xs text-success-100 flex items-center">
                <Sparkles className="w-3 h-3 mr-1" />
                Annual savings: {benefits.totalSavings}
              </div>
            </div>
          )}

          <div className="border-t border-gray-700 pt-4">
            <div className="flex items-center text-sm text-gray-400 mb-2">
              <Shield className="w-4 h-4 mr-2 text-success-100" />
              {subscriptionData.plan.trial.duration}-day free trial included
            </div>
            <div className="flex items-center text-sm text-gray-400">
              <Lock className="w-4 h-4 mr-2 text-success-100" />
              Cancel anytime, no commitments
            </div>
          </div>
        </div>
      </div>
    );
  };

  const PaymentSection = () => (
    <div className="bg-dark-200/50 rounded-2xl p-8 backdrop-blur-sm paypal-container">
      <h3 className="text-2xl font-bold text-white text-center mb-6">
        Complete Your Subscription
      </h3>
      
      <PayPalSubscriptionButton
        planId={pricing.paypalPlanId}
        planType={subscriptionData.planId}
        planName={pricing.planName}
        price={pricing.isYearly ? pricing.monthlyEquivalent.replace('$', '') : pricing.price.replace('$', '')}
        billingCycle={subscriptionData.billingCycle}
        userEmail={userEmail}
        userName={userName}
        onSuccess={handleSubscriptionSuccessEnhanced}
        onError={handleSubscriptionErrorEnhanced}
        className="w-full"
        size="lg"
      />
      
      <TrustSignals />
    </div>
  );

  const TrustSignals = () => (
    <div className="text-center space-y-4 py-6">
      <div className="flex items-center justify-center space-x-8 text-sm text-gray-500">
        {[
          { icon: Shield, text: 'Secure Payment' },
          { icon: Lock, text: '256-bit SSL' },
          { icon: Award, text: 'Money-back Guarantee' }
        ].map(({ icon: Icon, text }) => (
          <div key={text} className="flex items-center trust-signal">
            <Icon className="w-4 h-4 mr-2 text-success-100" />
            <span>{text}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-500">
        Secure payments powered by PayPal • No setup fees • No hidden charges
      </p>
    </div>
  );

  const BillingToggle = () => (
    <div className="flex items-center justify-center space-x-6 billing-toggle">
      <span className={cn(
        "text-xl font-medium transition-colors",
        !pricing.isYearly ? "text-white" : "text-gray-400"
      )}>
        Monthly
      </span>
      <div className="relative">
        <Switch
          checked={pricing.isYearly}
          onCheckedChange={(checked) => handleBillingToggle(checked ? 'yearly' : 'monthly')}
          className="data-[state=checked]:bg-primary-200 scale-125"
        />
      </div>
      <div className="flex items-center space-x-3">
        <span className={cn(
          "text-xl font-medium transition-colors",
          pricing.isYearly ? "text-white" : "text-gray-400"
        )}>
          Yearly
        </span>
        <Badge className="bg-success-100/20 text-success-100 border-success-100/50 text-sm px-3 py-1 savings-badge">
          <Sparkles className="w-3 h-3 mr-1" />
          Save 17%
        </Badge>
      </div>
    </div>
  );

  // Show confirmation screen after successful subscription
  if (step === 'success') {
    return (
      <div className={cn("w-full max-w-7xl mx-auto px-4", className)}>
        <SubscriptionConfirmation
          subscriptionData={subscriptionData}
          onUpgrade={(planId, billingCycle = subscriptionData.billingCycle) => {
            toast.info('Plan Upgrade', {
              description: 'Redirecting to PayPal to upgrade your subscription...',
              action: {
                label: 'Continue',
                onClick: () => window.open('https://www.paypal.com/myaccount/autopay/', '_blank')
              }
            });
          }}
          onDowngrade={(planId) => {
            toast.info('Plan Downgrade', {
              description: 'Contact support to downgrade your subscription.',
              action: {
                label: 'Contact',
                onClick: () => window.open('/contact', '_blank')
              }
            });
          }}
          onManagePayPal={() => {
            window.open('https://www.paypal.com/myaccount/autopay/', '_blank');
          }}
          onViewDashboard={() => {
            window.location.href = '/dashboard';
          }}
        />
      </div>
    );
  }

  return (
    <PayPalScriptProvider
      options={{
        "client-id": process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID,
        vault: true,
        intent: "subscription",
        currency: "USD"
      }}
    >
      <div className={cn("w-full max-w-7xl mx-auto px-4 space-y-16 subscription-checkout", className)}>
        <StepIndicator />

        {/* Header */}
        <div className="text-center space-y-6">
          <h1 className="text-5xl md:text-6xl font-bold text-white">
            Choose Your PrepBettr Plan
          </h1>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            {stepInfo.description}
          </p>
          
          <div className="flex items-center justify-center space-x-8 text-sm text-gray-500 pt-4">
            {[
              ['10,000+', 'Success Stories'],
              ['95%', 'Interview Success'],
              ['4.9★', 'User Rating']
            ].map(([stat, label]) => (
              <div key={label} className="flex items-center">
                <span className="text-primary-200 font-bold text-2xl">{stat}</span>
                <span className="ml-2">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <BillingToggle />

        {/* Plan Selection */}
        <div className="grid lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {getAvailablePlans().map((plan) => (
            <PlanCard key={plan.key} plan={plan} />
          ))}
        </div>

        <PlanComparisonTable />

        <div className="max-w-2xl mx-auto space-y-8">
          <SelectedPlanSummary />
          <PaymentSection />
        </div>
      </div>
    </PayPalScriptProvider>
  );
};

export default EnhancedSubscriptionCheckout;
