'use client';

import React, { useState, useEffect } from 'react';
import { PayPalScriptProvider } from '@paypal/react-paypal-js';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Zap, Building2, Crown, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import PayPalSubscriptionButton from './PayPalSubscriptionButton';

const SubscriptionPlans = ({ 
  userEmail, 
  userName,
  className = "",
  onSubscriptionSuccess,
  onSubscriptionError 
}) => {
  const [isYearly, setIsYearly] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Plan configurations based on our PayPal config
  const plans = {
    individual: {
      name: 'Individual',
      description: 'Perfect for job seekers',
      icon: <Zap className="h-8 w-8 text-primary-200" />,
      monthly: {
        price: 49,
        planId: 'individual-monthly', // This will need to be the actual PayPal plan ID
        savings: null
      },
      yearly: {
        price: 490,
        planId: 'individual-yearly', // This will need to be the actual PayPal plan ID
        savings: 17,
        monthlyEquivalent: 40.83
      },
      features: [
        'Resume processing and optimization',
        'AI-powered interview preparation',
        'Cover letter generation',
        'Basic career insights',
        'Email support',
        'Up to 10 resumes per month',
        'Up to 20 interview sessions per month',
        'Up to 5 cover letters per month'
      ],
      popular: false
    },
    enterprise: {
      name: 'Enterprise',
      description: 'For teams and organizations',
      icon: <Building2 className="h-8 w-8 text-primary-200" />,
      monthly: {
        price: 199,
        planId: 'enterprise-monthly', // This will need to be the actual PayPal plan ID
        savings: null
      },
      yearly: {
        price: 1990,
        planId: 'enterprise-yearly', // This will need to be the actual PayPal plan ID
        savings: 17,
        monthlyEquivalent: 165.83
      },
      features: [
        'Everything in Individual plan',
        'Unlimited resume processing',
        'Unlimited interview sessions',
        'Unlimited cover letters',
        'Advanced career analytics',
        'Priority support',
        'Custom branding options',
        'Team collaboration features',
        'API access',
        'Dedicated account manager'
      ],
      popular: true
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(price);
  };

  const calculateYearlySavings = (monthlyPrice) => {
    const yearlyTotal = monthlyPrice * 12;
    const yearlyPrice = monthlyPrice * 10;
    return yearlyTotal - yearlyPrice;
  };

  const handleSubscriptionSuccess = (subscriptionData, planType) => {
    console.log('Subscription successful:', subscriptionData, planType);
    if (onSubscriptionSuccess) {
      onSubscriptionSuccess(subscriptionData, planType);
    }
  };

  const handleSubscriptionError = (error, planType) => {
    console.error('Subscription error:', error, planType);
    if (onSubscriptionError) {
      onSubscriptionError(error, planType);
    }
  };

  const PlanCard = ({ planKey, plan }) => {
    const currentPlan = isYearly ? plan.yearly : plan.monthly;
    const isPopular = plan.popular;

    return (
      <Card className={cn(
        "relative overflow-hidden transition-all duration-300 hover:shadow-lg",
        "bg-gray-900/50 border-gray-700 backdrop-blur-sm",
        isPopular && "ring-2 ring-primary-200/50 scale-105",
        className
      )}>
        {isPopular && (
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <Badge className="bg-primary-200 text-dark-100 px-3 py-1 font-semibold">
              <Crown className="w-3 h-3 mr-1" />
              Most Popular
            </Badge>
          </div>
        )}

        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-3">
            {plan.icon}
          </div>
          <CardTitle className="text-2xl font-bold text-white">
            {plan.name}
          </CardTitle>
          <CardDescription className="text-gray-400 text-base">
            {plan.description}
          </CardDescription>
        </CardHeader>

        <CardContent className="px-6 pb-6">
          {/* Pricing Section */}
          <div className="text-center mb-6">
            <div className="flex items-baseline justify-center mb-2">
              <span className="text-4xl font-bold text-white">
                {formatPrice(isYearly ? currentPlan.monthlyEquivalent : currentPlan.price)}
              </span>
              <span className="text-gray-400 ml-2">
                /month
              </span>
            </div>
            
            {isYearly && (
              <div className="space-y-1">
                <p className="text-sm text-gray-400">
                  Billed {formatPrice(currentPlan.price)} annually
                </p>
                <div className="flex items-center justify-center">
                  <Badge variant="outline" className="bg-green-900/20 text-green-400 border-green-500/30">
                    <Sparkles className="w-3 h-3 mr-1" />
                    Save {currentPlan.savings}% yearly
                  </Badge>
                </div>
                <p className="text-xs text-green-400">
                  Save {formatPrice(calculateYearlySavings(plan.monthly.price))} per year
                </p>
              </div>
            )}
          </div>

          {/* Features List */}
          <div className="space-y-3">
            {plan.features.map((feature, index) => (
              <div key={index} className="flex items-start">
                <CheckCircle className="h-5 w-5 text-green-500 mr-3 mt-0.5 shrink-0" />
                <span className="text-gray-300 text-sm leading-relaxed">
                  {feature}
                </span>
              </div>
            ))}
          </div>
        </CardContent>

        <CardFooter className="px-6 pb-6">
          <div className="w-full">
            <PayPalSubscriptionButton
              planId={currentPlan.planId}
              planType={planKey}
              planName={`${plan.name} ${isYearly ? 'Yearly' : 'Monthly'}`}
              price={isYearly ? currentPlan.monthlyEquivalent : currentPlan.price}
              billingCycle={isYearly ? 'yearly' : 'monthly'}
              userEmail={userEmail}
              userName={userName}
              onSuccess={(data) => handleSubscriptionSuccess(data, planKey)}
              onError={(error) => handleSubscriptionError(error, planKey)}
              className="w-full"
              variant={isPopular ? "default" : "outline"}
            />
          </div>
        </CardFooter>
      </Card>
    );
  };

  return (
    <PayPalScriptProvider
      options={{
        "client-id": process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID,
        vault: true,
        intent: "subscription",
        currency: "USD"
      }}
    >
      <div className={cn("w-full max-w-7xl mx-auto px-4", className)}>
        {/* Header Section */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-white mb-4">
            Choose Your Plan
          </h2>
          <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
            Unlock your career potential with AI-powered tools designed to help you succeed
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center space-x-4 mb-8">
            <span className={cn(
              "text-lg font-medium transition-colors",
              !isYearly ? "text-white" : "text-gray-400"
            )}>
              Monthly
            </span>
            <div className="relative">
              <Switch
                checked={isYearly}
                onCheckedChange={setIsYearly}
                className="data-[state=checked]:bg-primary-200"
              />
            </div>
            <div className="flex items-center space-x-2">
              <span className={cn(
                "text-lg font-medium transition-colors",
                isYearly ? "text-white" : "text-gray-400"
              )}>
                Yearly
              </span>
              <Badge className="bg-green-900/20 text-green-400 border-green-500/30 text-xs px-2 py-1">
                Save 17%
              </Badge>
            </div>
          </div>
        </div>

        {/* Plans Grid */}
        <div className="grid md:grid-cols-2 gap-8 lg:gap-12 max-w-5xl mx-auto">
          {Object.entries(plans).map(([planKey, plan]) => (
            <PlanCard key={planKey} planKey={planKey} plan={plan} />
          ))}
        </div>

        {/* Footer Info */}
        <div className="text-center mt-12 space-y-4">
          <p className="text-gray-400 text-sm">
            All plans include a 7-day free trial. Cancel anytime.
          </p>
          <p className="text-gray-500 text-xs">
            Secure payments powered by PayPal • No setup fees • No commitments
          </p>
        </div>
      </div>
    </PayPalScriptProvider>
  );
};

export default SubscriptionPlans;
