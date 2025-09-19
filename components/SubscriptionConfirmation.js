'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle, 
  Calendar, 
  CreditCard, 
  Settings, 
  ExternalLink, 
  ArrowRight,
  Crown,
  Sparkles,
  Shield,
  Clock,
  ChevronRight,
  RefreshCw,
  TrendingUp,
  Award
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { subscriptionUtils } from '@/lib/subscription-utils';
import { toast } from 'sonner';

const SubscriptionConfirmation = ({ 
  subscriptionData,
  onUpgrade,
  onDowngrade,
  onManagePayPal,
  onViewDashboard,
  className = ""
}) => {
  const [timeUntilBilling, setTimeUntilBilling] = useState(null);

  // Update countdown timer
  useEffect(() => {
    if (!subscriptionData?.nextBillingDate) return;

    const updateTimer = () => {
      const days = subscriptionUtils.getDaysUntilBilling(subscriptionData.nextBillingDate);
      setTimeUntilBilling(days);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [subscriptionData?.nextBillingDate]);

  if (!subscriptionData) {
    return (
      <Card className="w-full max-w-2xl mx-auto dark-gradient border-gray-700">
        <CardContent className="p-8 text-center">
          <div className="animate-pulse space-y-4">
            <div className="h-16 w-16 bg-gray-700 rounded-full mx-auto"></div>
            <div className="h-4 bg-gray-700 rounded w-3/4 mx-auto"></div>
            <div className="h-4 bg-gray-700 rounded w-1/2 mx-auto"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const summary = subscriptionData.getSummary();
  const yearlyBenefits = subscriptionData.billingCycle === 'yearly' ? {
    totalSavings: summary.yearlySavings,
    savingsPercentage: summary.savingsPercentage,
    monthsFree: summary.monthsFree
  } : null;

  const SubscriptionHeader = () => (
    <CardHeader className="text-center pb-6">
      <div className="w-20 h-20 rounded-full bg-success-100/20 flex items-center justify-center mx-auto mb-4">
        <CheckCircle className="h-10 w-10 text-success-100" />
      </div>
      <CardTitle className="text-3xl font-bold text-white mb-2">
        Subscription Active!
      </CardTitle>
      <CardDescription className="text-gray-400 text-lg">
        Welcome to PrepBettr {summary.planName}
      </CardDescription>
      
      {subscriptionData.plan.popular && (
        <div className="flex justify-center mt-4">
          <Badge className="bg-primary-200 text-dark-100 px-4 py-2 font-semibold">
            <Crown className="w-4 h-4 mr-2" />
            Most Popular Plan
          </Badge>
        </div>
      )}
    </CardHeader>
  );

  const SubscriptionDetails = () => (
    <div className="space-y-6">
      {/* Plan Summary */}
      <div className="bg-dark-200/50 rounded-2xl p-6">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center">
          <Award className="w-5 h-5 mr-2 text-primary-200" />
          Subscription Details
        </h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Plan</span>
            <span className="text-white font-semibold">{summary.planName}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Price</span>
            <div className="text-right">
              <span className="text-white font-semibold">
                {summary.monthlyEquivalent}/month
              </span>
              {yearlyBenefits && (
                <p className="text-xs text-success-100">
                  Billed {summary.price} annually
                </p>
              )}
            </div>
          </div>

          {yearlyBenefits && (
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Annual Savings</span>
              <div className="text-right">
                <span className="text-success-100 font-semibold">
                  {yearlyBenefits.totalSavings}
                </span>
                <p className="text-xs text-success-100">
                  {yearlyBenefits.savingsPercentage}% off
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-gray-400">Status</span>
            <Badge className="bg-success-100/20 text-success-100 border-success-100/30">
              {subscriptionUtils.getStatusDisplay(subscriptionData.status)}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-gray-400">Subscription ID</span>
            <span className="text-white font-mono text-sm">
              {subscriptionData.paypalSubscriptionId?.slice(-8) || 'XXXXXXXX'}
            </span>
          </div>
        </div>
      </div>

      {/* Billing Information */}
      <div className="bg-dark-200/50 rounded-2xl p-6">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center">
          <Calendar className="w-5 h-5 mr-2 text-primary-200" />
          Billing Information
        </h3>
        
        <div className="space-y-4">
          {summary.trialDuration && timeUntilBilling > 0 && (
            <div className="bg-primary-200/5 border border-primary-200/20 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-300">Free Trial</span>
                <Badge className="bg-primary-200/20 text-primary-200">
                  <Clock className="w-3 h-3 mr-1" />
                  {timeUntilBilling} days left
                </Badge>
              </div>
              <p className="text-sm text-gray-400">
                Your {summary.trialDuration}-day free trial ends on{' '}
                {subscriptionUtils.formatDate(summary.trialEndDate)}
              </p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-gray-400">Next Billing</span>
            <span className="text-white">
              {subscriptionUtils.formatDate(summary.nextBillingDate)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-gray-400">Billing Frequency</span>
            <span className="text-white">
              {subscriptionUtils.getBillingFrequencyText(summary.billingCycle)}
            </span>
          </div>

          {yearlyBenefits && (
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Renewal Date</span>
              <span className="text-white">
                {subscriptionUtils.formatDate(
                  new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
                )}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Yearly Benefits Highlight */}
      {yearlyBenefits && (
        <div className="bg-success-100/5 border border-success-100/20 rounded-2xl p-6">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center">
            <Sparkles className="w-5 h-5 mr-2 text-success-100" />
            Yearly Subscription Benefits
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-success-100/5 rounded-xl">
              <div className="text-2xl font-bold text-success-100 mb-1">
                {yearlyBenefits.totalSavings}
              </div>
              <div className="text-sm text-gray-400">Total Savings</div>
            </div>
            
            <div className="text-center p-4 bg-success-100/5 rounded-xl">
              <div className="text-2xl font-bold text-success-100 mb-1">
                {yearlyBenefits.monthsFree}
              </div>
              <div className="text-sm text-gray-400">Months Free</div>
            </div>
            
            <div className="text-center p-4 bg-success-100/5 rounded-xl">
              <div className="text-2xl font-bold text-success-100 mb-1">
                {yearlyBenefits.savingsPercentage}%
              </div>
              <div className="text-sm text-gray-400">Discount</div>
            </div>
          </div>

          <div className="mt-4 p-3 bg-success-100/10 rounded-lg">
            <p className="text-success-100 text-sm text-center">
              🎉 You're saving {yearlyBenefits.totalSavings} compared to monthly billing!
            </p>
          </div>
        </div>
      )}

      {/* Features Overview */}
      <div className="bg-dark-200/50 rounded-2xl p-6">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center">
          <CheckCircle className="w-5 h-5 mr-2 text-primary-200" />
          What's Included
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {summary.features.slice(0, 8).map((feature, index) => (
            <div key={index} className="flex items-center text-sm">
              <CheckCircle className="w-4 h-4 text-success-100 mr-2 shrink-0" />
              <span className="text-gray-300">{feature}</span>
            </div>
          ))}
        </div>

        {summary.features.length > 8 && (
          <div className="mt-3 text-center">
            <span className="text-primary-200 text-sm">
              + {summary.features.length - 8} more features
            </span>
          </div>
        )}
      </div>
    </div>
  );

  const ManagementActions = () => (
    <div className="space-y-4">
      <h3 className="text-xl font-bold text-white mb-4 flex items-center">
        <Settings className="w-5 h-5 mr-2 text-primary-200" />
        Subscription Management
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* PayPal Management */}
        <Button
          onClick={onManagePayPal}
          variant="outline"
          className="w-full flex items-center justify-between p-4 h-auto"
        >
          <div className="flex items-center">
            <CreditCard className="w-5 h-5 mr-3 text-primary-200" />
            <div className="text-left">
              <div className="font-semibold text-white">Manage via PayPal</div>
              <div className="text-xs text-gray-400">Update payment, cancel, etc.</div>
            </div>
          </div>
          <ExternalLink className="w-4 h-4 text-gray-400" />
        </Button>

        {/* Dashboard Access */}
        <Button
          onClick={onViewDashboard}
          className="w-full flex items-center justify-between p-4 h-auto"
        >
          <div className="flex items-center">
            <ArrowRight className="w-5 h-5 mr-3" />
            <div className="text-left">
              <div className="font-semibold">Go to Dashboard</div>
              <div className="text-xs opacity-80">Start using your features</div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Plan Change Options */}
      <div className="border-t border-gray-700 pt-4">
        <h4 className="font-semibold text-white mb-3">Plan Options</h4>
        <div className="space-y-2">
          {summary.planId === 'individual' && (
            <Button
              onClick={() => onUpgrade('enterprise')}
              variant="ghost"
              className="w-full justify-start text-left p-3"
            >
              <TrendingUp className="w-4 h-4 mr-3 text-success-100" />
              <div>
                <div className="font-medium text-white">Upgrade to Enterprise</div>
                <div className="text-xs text-gray-400">
                  Unlimited features and priority support
                </div>
              </div>
            </Button>
          )}

          {summary.planId === 'enterprise' && (
            <Button
              onClick={() => onDowngrade('individual')}
              variant="ghost"
              className="w-full justify-start text-left p-3"
            >
              <RefreshCw className="w-4 h-4 mr-3 text-primary-200" />
              <div>
                <div className="font-medium text-white">Switch to Individual</div>
                <div className="text-xs text-gray-400">
                  Downgrade to basic features
                </div>
              </div>
            </Button>
          )}

          {summary.billingCycle === 'monthly' && (
            <Button
              onClick={() => {
                const savings = subscriptionData.plan.pricing.yearly.savings;
                toast.success('Switch to Yearly', {
                  description: `Save ${savings}% with yearly billing!`,
                  action: {
                    label: 'Switch Now',
                    onClick: () => onUpgrade(summary.planId, 'yearly')
                  }
                });
              }}
              variant="ghost"
              className="w-full justify-start text-left p-3"
            >
              <Sparkles className="w-4 h-4 mr-3 text-success-100" />
              <div>
                <div className="font-medium text-white">Switch to Yearly</div>
                <div className="text-xs text-gray-400">
                  Save {subscriptionData.plan.pricing.yearly.savings}% with annual billing
                </div>
              </div>
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  const SecurityInfo = () => (
    <div className="bg-dark-200/30 rounded-2xl p-6 text-center">
      <Shield className="w-8 h-8 text-success-100 mx-auto mb-3" />
      <h4 className="font-semibold text-white mb-2">Your Subscription is Secure</h4>
      <p className="text-sm text-gray-400 mb-4">
        Payments are processed securely through PayPal with enterprise-grade encryption.
        You can cancel or modify your subscription at any time.
      </p>
      <div className="flex items-center justify-center space-x-6 text-xs text-gray-500">
        <span>256-bit SSL</span>
        <span>•</span>
        <span>PCI Compliant</span>
        <span>•</span>
        <span>30-day Guarantee</span>
      </div>
    </div>
  );

  return (
    <Card className={cn("w-full max-w-4xl mx-auto dark-gradient border-gray-700", className)}>
      <SubscriptionHeader />
      
      <CardContent className="px-8 pb-8 space-y-8">
        <SubscriptionDetails />
        <ManagementActions />
        <SecurityInfo />
      </CardContent>
    </Card>
  );
};

export default SubscriptionConfirmation;
