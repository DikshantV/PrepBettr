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
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import PayPalSubscriptionButton from './PayPalSubscriptionButton';
import { toast } from 'sonner';

const SubscriptionCheckout = ({ 
  userEmail, 
  userName,
  className = "",
  onSubscriptionSuccess,
  onSubscriptionError 
}) => {
  const [isYearly, setIsYearly] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('individual');
  const [showMobileComparison, setShowMobileComparison] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Plan configurations
  const plans = {
    individual: {
      name: 'Individual',
      description: 'Perfect for job seekers',
      icon: <Zap className="h-8 w-8 text-primary-200" />,
      monthly: {
        price: 49,
        planId: 'individual-monthly',
        savings: null
      },
      yearly: {
        price: 490,
        planId: 'individual-yearly',
        savings: 17,
        monthlyEquivalent: 40.83
      },
      features: [
        { text: 'Resume processing and optimization', icon: <Star className="w-4 h-4" /> },
        { text: 'AI-powered interview preparation', icon: <Zap className="w-4 h-4" /> },
        { text: 'Cover letter generation', icon: <Award className="w-4 h-4" /> },
        { text: 'Basic career insights', icon: <BarChart3 className="w-4 h-4" /> },
        { text: 'Email support', icon: <Headphones className="w-4 h-4" /> },
        { text: 'Up to 10 resumes per month', icon: <Clock className="w-4 h-4" /> },
        { text: 'Up to 20 interview sessions per month', icon: <Users className="w-4 h-4" /> },
        { text: 'Up to 5 cover letters per month', icon: <Settings className="w-4 h-4" /> }
      ],
      popular: false,
      recommended: false
    },
    enterprise: {
      name: 'Enterprise',
      description: 'For teams and organizations',
      icon: <Building2 className="h-8 w-8 text-primary-200" />,
      monthly: {
        price: 199,
        planId: 'enterprise-monthly',
        savings: null
      },
      yearly: {
        price: 1990,
        planId: 'enterprise-yearly',
        savings: 17,
        monthlyEquivalent: 165.83
      },
      features: [
        { text: 'Everything in Individual plan', icon: <CheckCircle className="w-4 h-4" /> },
        { text: 'Unlimited resume processing', icon: <Star className="w-4 h-4" /> },
        { text: 'Unlimited interview sessions', icon: <Users className="w-4 h-4" /> },
        { text: 'Unlimited cover letters', icon: <Award className="w-4 h-4" /> },
        { text: 'Advanced career analytics', icon: <BarChart3 className="w-4 h-4" /> },
        { text: 'Priority support', icon: <Headphones className="w-4 h-4" /> },
        { text: 'Custom branding options', icon: <Settings className="w-4 h-4" /> },
        { text: 'Team collaboration features', icon: <Users className="w-4 h-4" /> },
        { text: 'API access', icon: <Settings className="w-4 h-4" /> },
        { text: 'Dedicated account manager', icon: <Crown className="w-4 h-4" /> }
      ],
      popular: true,
      recommended: true
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

  const PlanComparisonTable = () => (
    <div className="w-full overflow-hidden">
      <div className="bg-dark-200/50 rounded-2xl p-6 backdrop-blur-sm">
        <h3 className="text-2xl font-bold text-white text-center mb-8">
          Compare Plans
        </h3>
        
        {/* Mobile Comparison Toggle */}
        <div className="md:hidden mb-6">
          <button
            onClick={() => setShowMobileComparison(!showMobileComparison)}
            className="flex items-center justify-between w-full p-4 bg-dark-300/50 rounded-xl text-white"
          >
            <span className="font-medium">View Feature Comparison</span>
            {showMobileComparison ? <ChevronUp /> : <ChevronDown />}
          </button>
        </div>

        {/* Comparison Table */}
        <div className={cn(
          "transition-all duration-300",
          showMobileComparison || "max-md:hidden"
        )}>
          <div className="grid md:grid-cols-3 gap-4">
            {/* Feature Column */}
            <div className="space-y-4">
              <div className="h-20 flex items-end">
                <h4 className="font-semibold text-primary-200 text-lg">Features</h4>
              </div>
              {Object.values(plans)[0].features.map((feature, index) => (
                <div key={index} className="flex items-center h-12 text-sm text-gray-300">
                  {feature.icon}
                  <span className="ml-2">{feature.text}</span>
                </div>
              ))}
            </div>

            {/* Individual Plan Column */}
            <div className="space-y-4">
              <div className="bg-dark-300/30 rounded-xl p-4 h-20 flex flex-col justify-center">
                <h4 className="font-bold text-white text-center">Individual</h4>
                <p className="text-primary-200 text-center text-sm">
                  {formatPrice(isYearly ? plans.individual.yearly.monthlyEquivalent : plans.individual.monthly.price)}/mo
                </p>
              </div>
              {plans.individual.features.map((_, index) => (
                <div key={index} className="flex items-center justify-center h-12">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                </div>
              ))}
            </div>

            {/* Enterprise Plan Column */}
            <div className="space-y-4">
              <div className="bg-primary-200/10 border border-primary-200/30 rounded-xl p-4 h-20 flex flex-col justify-center relative">
                <Badge className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-primary-200 text-dark-100 text-xs">
                  Most Popular
                </Badge>
                <h4 className="font-bold text-white text-center">Enterprise</h4>
                <p className="text-primary-200 text-center text-sm">
                  {formatPrice(isYearly ? plans.enterprise.yearly.monthlyEquivalent : plans.enterprise.monthly.price)}/mo
                </p>
              </div>
              {plans.enterprise.features.map((_, index) => (
                <div key={index} className="flex items-center justify-center h-12">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const PlanCard = ({ planKey, plan }) => {
    const currentPlan = isYearly ? plan.yearly : plan.monthly;
    const isSelected = selectedPlan === planKey;
    const isPopular = plan.popular;

    return (
      <Card 
        className={cn(
          "relative overflow-hidden transition-all duration-300 cursor-pointer group",
          "dark-gradient border-2 hover:scale-105 transform",
          isSelected ? "border-primary-200/80 ring-2 ring-primary-200/50" : "border-gray-700/50 hover:border-primary-200/30",
          isPopular && "scale-105 ring-2 ring-primary-200/30",
          className
        )}
        onClick={() => setSelectedPlan(planKey)}
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
              {plan.icon}
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
          {/* Pricing Section */}
          <div className="text-center mb-8 p-6 bg-dark-300/30 rounded-2xl">
            <div className="flex items-baseline justify-center mb-3">
              <span className="text-5xl font-bold text-white">
                {formatPrice(isYearly ? currentPlan.monthlyEquivalent : currentPlan.price)}
              </span>
              <span className="text-gray-400 ml-2 text-lg">
                /month
              </span>
            </div>
            
            {isYearly && (
              <div className="space-y-2">
                <p className="text-sm text-gray-400">
                  Billed {formatPrice(currentPlan.price)} annually
                </p>
                <div className="flex items-center justify-center">
                  <Badge variant="outline" className="bg-success-100/20 text-success-100 border-success-100/50">
                    <Sparkles className="w-3 h-3 mr-1" />
                    Save {currentPlan.savings}% yearly
                  </Badge>
                </div>
                <p className="text-xs text-success-100 font-semibold">
                  Save {formatPrice(calculateYearlySavings(plan.monthly.price))} per year!
                </p>
              </div>
            )}

            <div className="mt-4 text-center">
              <p className="text-xs text-gray-500">
                7-day free trial included
              </p>
            </div>
          </div>

          {/* Features List */}
          <div className="space-y-3">
            <h4 className="font-semibold text-white text-lg mb-4">What's included:</h4>
            {plan.features.slice(0, 6).map((feature, index) => (
              <div key={index} className="flex items-start group/feature">
                <div className="text-success-100 mr-3 mt-0.5 shrink-0">
                  {feature.icon}
                </div>
                <span className="text-gray-300 text-sm leading-relaxed group-hover/feature:text-white transition-colors">
                  {feature.text}
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
    const plan = plans[selectedPlan];
    const currentPlan = isYearly ? plan.yearly : plan.monthly;
    
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
              {plan.icon}
              <div>
                <h4 className="font-semibold text-white">
                  {plan.name} {isYearly ? 'Yearly' : 'Monthly'}
                </h4>
                <p className="text-sm text-gray-400">
                  {isYearly ? 'Billed annually' : 'Billed monthly'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-bold text-white text-lg">
                {formatPrice(isYearly ? currentPlan.monthlyEquivalent : currentPlan.price)}
                <span className="text-sm text-gray-400 font-normal">/mo</span>
              </p>
              {isYearly && (
                <p className="text-xs text-success-100">
                  Save {currentPlan.savings}%
                </p>
              )}
            </div>
          </div>

          {isYearly && (
            <div className="bg-success-100/5 border border-success-100/20 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-300">Total billed today:</span>
                <span className="font-semibold text-white">{formatPrice(0)}</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-sm text-gray-300">Next billing ({new Date(Date.now() + 7*24*60*60*1000).toLocaleDateString()}):</span>
                <span className="font-semibold text-white">{formatPrice(currentPlan.price)}</span>
              </div>
              <p className="text-xs text-success-100 mt-2 flex items-center">
                <Sparkles className="w-3 h-3 mr-1" />
                Annual savings: {formatPrice(calculateYearlySavings(plan.monthly.price))}
              </p>
            </div>
          )}

          <div className="border-t border-gray-700 pt-4">
            <div className="flex items-center text-sm text-gray-400 mb-2">
              <Shield className="w-4 h-4 mr-2 text-success-100" />
              7-day free trial included
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

  const TrustSignals = () => (
    <div className="text-center space-y-4 py-6">
      <div className="flex items-center justify-center space-x-8 text-sm text-gray-500">
        <div className="flex items-center">
          <Shield className="w-4 h-4 mr-2 text-success-100" />
          <span>Secure Payment</span>
        </div>
        <div className="flex items-center">
          <Lock className="w-4 h-4 mr-2 text-success-100" />
          <span>256-bit SSL</span>
        </div>
        <div className="flex items-center">
          <Award className="w-4 h-4 mr-2 text-success-100" />
          <span>Money-back Guarantee</span>
        </div>
      </div>
      <p className="text-xs text-gray-500">
        Secure payments powered by PayPal • No setup fees • No hidden charges
      </p>
    </div>
  );

  const FAQSection = () => (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold text-white text-center mb-12">
        Frequently Asked Questions
      </h2>
      
      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="bg-dark-200/30 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
              <Info className="w-5 h-5 mr-2 text-primary-200" />
              How does the free trial work?
            </h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Start with a 7-day free trial with full access to all features. Your subscription will automatically begin after the trial period. Cancel anytime during the trial with no charges.
            </p>
          </div>
          
          <div className="bg-dark-200/30 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
              <Settings className="w-5 h-5 mr-2 text-primary-200" />
              Can I change my plan later?
            </h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Absolutely! You can upgrade, downgrade, or cancel your subscription anytime from your account dashboard. Changes take effect immediately.
            </p>
          </div>

          <div className="bg-dark-200/30 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
              <Shield className="w-5 h-5 mr-2 text-primary-200" />
              What payment methods do you accept?
            </h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              We accept all major payment methods through PayPal, including credit cards, debit cards, bank transfers, and PayPal balance.
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-dark-200/30 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
              <Lock className="w-5 h-5 mr-2 text-primary-200" />
              Is my data secure?
            </h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Yes! We use enterprise-grade security, 256-bit SSL encryption, and comply with industry standards to protect your personal information and career data.
            </p>
          </div>

          <div className="bg-dark-200/30 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
              <Award className="w-5 h-5 mr-2 text-primary-200" />
              Do you offer refunds?
            </h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              We offer a 30-day money-back guarantee. If you're not completely satisfied with our service, contact support for a full refund.
            </p>
          </div>

          <div className="bg-dark-200/30 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
              <Headphones className="w-5 h-5 mr-2 text-primary-200" />
              Need help choosing?
            </h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Our support team is here to help! Contact us for personalized recommendations based on your career goals and needs.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <PayPalScriptProvider
      options={{
        "client-id": process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID,
        vault: true,
        intent: "subscription",
        currency: "USD"
      }}
    >
      <div className={cn("w-full max-w-7xl mx-auto px-4 space-y-16", className)}>
        {/* Header */}
        <div className="text-center space-y-6">
          <h1 className="text-5xl md:text-6xl font-bold text-white">
            Choose Your PrepBettr Plan
          </h1>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            Unlock your career potential with AI-powered tools designed for success. 
            Start your free trial today and transform your job search.
          </p>
          
          {/* Social Proof */}
          <div className="flex items-center justify-center space-x-8 text-sm text-gray-500 pt-4">
            <div className="flex items-center">
              <span className="text-primary-200 font-bold text-2xl">10,000+</span>
              <span className="ml-2">Success Stories</span>
            </div>
            <div className="flex items-center">
              <span className="text-primary-200 font-bold text-2xl">95%</span>
              <span className="ml-2">Interview Success</span>
            </div>
            <div className="flex items-center">
              <span className="text-primary-200 font-bold text-2xl">4.9★</span>
              <span className="ml-2">User Rating</span>
            </div>
          </div>
        </div>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center space-x-6">
          <span className={cn(
            "text-xl font-medium transition-colors",
            !isYearly ? "text-white" : "text-gray-400"
          )}>
            Monthly
          </span>
          <div className="relative">
            <Switch
              checked={isYearly}
              onCheckedChange={setIsYearly}
              className="data-[state=checked]:bg-primary-200 scale-125"
            />
          </div>
          <div className="flex items-center space-x-3">
            <span className={cn(
              "text-xl font-medium transition-colors",
              isYearly ? "text-white" : "text-gray-400"
            )}>
              Yearly
            </span>
            <Badge className="bg-success-100/20 text-success-100 border-success-100/50 text-sm px-3 py-1 animate-pulse">
              <Sparkles className="w-3 h-3 mr-1" />
              Save 17%
            </Badge>
          </div>
        </div>

        {/* Plan Selection */}
        <div className="grid lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {Object.entries(plans).map(([planKey, plan]) => (
            <PlanCard key={planKey} planKey={planKey} plan={plan} />
          ))}
        </div>

        {/* Plan Comparison Table */}
        <PlanComparisonTable />

        {/* Selected Plan Summary & Payment */}
        <div className="max-w-2xl mx-auto space-y-8">
          <SelectedPlanSummary />
          
          {/* PayPal Payment Section */}
          <div className="bg-dark-200/50 rounded-2xl p-8 backdrop-blur-sm">
            <h3 className="text-2xl font-bold text-white text-center mb-6">
              Complete Your Subscription
            </h3>
            
            <PayPalSubscriptionButton
              planId={plans[selectedPlan][isYearly ? 'yearly' : 'monthly'].planId}
              planType={selectedPlan}
              planName={`${plans[selectedPlan].name} ${isYearly ? 'Yearly' : 'Monthly'}`}
              price={isYearly ? plans[selectedPlan].yearly.monthlyEquivalent : plans[selectedPlan].monthly.price}
              billingCycle={isYearly ? 'yearly' : 'monthly'}
              userEmail={userEmail}
              userName={userName}
              onSuccess={(data) => handleSubscriptionSuccess(data, selectedPlan)}
              onError={(error) => handleSubscriptionError(error, selectedPlan)}
              className="w-full"
              size="lg"
            />
            
            <TrustSignals />
          </div>
        </div>

        {/* FAQ Section */}
        <FAQSection />
      </div>
    </PayPalScriptProvider>
  );
};

export default SubscriptionCheckout;
