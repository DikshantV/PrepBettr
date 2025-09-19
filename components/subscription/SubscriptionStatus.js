'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  CreditCard,
  Calendar,
  ArrowUpCircle,
  ArrowDownCircle,
  Settings,
  ExternalLink,
  RefreshCw,
  Zap,
  Building2,
  Crown,
  Gift,
  TrendingUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { pricingUtils, PREPBETTR_PLANS } from '@/lib/pricing-config';

/**
 * SubscriptionStatus - Component for displaying user subscription status and management
 * 
 * @param {Object} props
 * @param {Object} props.subscription - User's subscription data
 * @param {Function} props.onPlanChange - Callback for plan changes
 * @param {Function} props.onBillingChange - Callback for billing cycle changes  
 * @param {Function} props.onCancel - Callback for cancellation
 * @param {Function} props.onReactivate - Callback for reactivation
 * @param {boolean} props.showActions - Whether to show action buttons
 * @param {string} props.variant - Display variant: 'full', 'compact', 'minimal'
 * @param {string} props.className - Additional CSS classes
 */
const SubscriptionStatus = ({
  subscription,
  userUsage = {},
  onPlanChange = () => {},
  onBillingChange = () => {},
  onCancel = () => {},
  onReactivate = () => {},
  onUpdatePayment = () => {},
  showActions = true,
  showUsage = true,
  showBilling = true,
  variant = 'full',
  className = ''
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [actionType, setActionType] = useState(null);

  // Handle action with loading state
  const handleAction = async (action, callback, ...args) => {
    setIsLoading(true);
    setActionType(action);
    try {
      await callback(...args);
    } catch (error) {
      console.error(`Action ${action} failed:`, error);
    } finally {
      setIsLoading(false);
      setActionType(null);
    }
  };

  // Get status configuration
  const getStatusConfig = (status) => {
    const statusConfig = {
      active: {
        icon: <CheckCircle className="w-5 h-5 text-green-500" />,
        badge: 'bg-green-900/20 text-green-400 border-green-500/30',
        text: 'Active',
        description: 'Your subscription is active and all features are available'
      },
      trialing: {
        icon: <Gift className="w-5 h-5 text-blue-500" />,
        badge: 'bg-blue-900/20 text-blue-400 border-blue-500/30',
        text: 'Free Trial',
        description: 'You are currently in your free trial period'
      },
      past_due: {
        icon: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
        badge: 'bg-yellow-900/20 text-yellow-400 border-yellow-500/30',
        text: 'Payment Due',
        description: 'Please update your payment method to continue service'
      },
      cancelled: {
        icon: <XCircle className="w-5 h-5 text-red-500" />,
        badge: 'bg-red-900/20 text-red-400 border-red-500/30',
        text: 'Cancelled',
        description: 'Your subscription has been cancelled'
      },
      expired: {
        icon: <Clock className="w-5 h-5 text-gray-500" />,
        badge: 'bg-gray-900/20 text-gray-400 border-gray-500/30',
        text: 'Expired',
        description: 'Your subscription has expired'
      }
    };

    return statusConfig[status] || statusConfig.active;
  };

  // Get plan configuration
  const getPlanConfig = () => {
    if (!subscription) return null;
    return PREPBETTR_PLANS[subscription.planId] || null;
  };

  // Format dates
  const formatDate = (date, options = {}) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      ...options
    });
  };

  // Calculate days remaining
  const getDaysRemaining = (endDate) => {
    if (!endDate) return null;
    const now = new Date();
    const end = new Date(endDate);
    const diffTime = end - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  // Get usage percentage
  const getUsagePercentage = (used, limit) => {
    if (limit === -1) return 0; // Unlimited
    if (limit === 0) return 100;
    return Math.min((used / limit) * 100, 100);
  };

  // Render usage bar
  const UsageBar = ({ used, limit, label, icon }) => {
    const percentage = getUsagePercentage(used, limit);
    const isUnlimited = limit === -1;
    const isNearLimit = percentage >= 80 && !isUnlimited;

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {icon}
            <span className="text-sm text-gray-300">{label}</span>
          </div>
          <span className="text-xs text-gray-400">
            {isUnlimited ? `${used} used` : `${used} / ${limit}`}
          </span>
        </div>
        
        {!isUnlimited && (
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className={cn(
                'h-2 rounded-full transition-all duration-300',
                isNearLimit ? 'bg-yellow-500' : 'bg-primary-200'
              )}
              style={{ width: `${percentage}%` }}
            />
          </div>
        )}
        
        {isUnlimited && (
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div className="h-2 rounded-full bg-green-500 animate-pulse" style={{ width: '100%' }} />
          </div>
        )}
      </div>
    );
  };

  if (!subscription) {
    return (
      <Card className={cn('bg-gray-900/50 border-gray-700', className)}>
        <CardContent className="p-6 text-center">
          <p className="text-gray-400">No active subscription</p>
          <Button className="mt-4" onClick={() => window.location.href = '/subscription'}>
            Choose a Plan
          </Button>
        </CardContent>
      </Card>
    );
  }

  const statusConfig = getStatusConfig(subscription.status);
  const planConfig = getPlanConfig();
  const isYearly = subscription.billingCycle === 'yearly';
  const daysRemaining = getDaysRemaining(subscription.currentPeriodEnd);

  // Minimal variant
  if (variant === 'minimal') {
    return (
      <div className={cn('flex items-center space-x-3', className)}>
        {statusConfig.icon}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">
            {planConfig?.name} Plan
          </p>
          <p className="text-xs text-gray-400 truncate">
            {statusConfig.text}
          </p>
        </div>
        <Badge className={statusConfig.badge}>
          {subscription.status}
        </Badge>
      </div>
    );
  }

  // Compact variant
  if (variant === 'compact') {
    return (
      <Card className={cn('bg-gray-900/50 border-gray-700', className)}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              {statusConfig.icon}
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {planConfig?.name} Plan
                </h3>
                <p className="text-sm text-gray-400">
                  {pricingUtils.formatPrice(subscription.price)}/month
                </p>
              </div>
            </div>
            <Badge className={statusConfig.badge}>
              {statusConfig.text}
            </Badge>
          </div>

          {showBilling && (
            <div className="text-xs text-gray-400 mb-3">
              Next billing: {formatDate(subscription.currentPeriodEnd)}
            </div>
          )}

          {showActions && (
            <div className="flex space-x-2">
              <Button size="sm" variant="outline" onClick={() => onPlanChange()}>
                Manage Plan
              </Button>
              {subscription.status === 'active' && (
                <Button size="sm" variant="ghost" onClick={() => onCancel()}>
                  Cancel
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Full variant
  return (
    <div className={cn('space-y-6', className)}>
      {/* Main Subscription Card */}
      <Card className="bg-gray-900/50 border-gray-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-primary-200/10">
                {planConfig?.icon === 'zap' ? 
                  <Zap className="w-6 h-6 text-primary-200" /> : 
                  <Building2 className="w-6 h-6 text-primary-200" />
                }
              </div>
              <div>
                <CardTitle className="text-white">
                  {planConfig?.name} Plan
                  {planConfig?.popular && (
                    <Crown className="w-4 h-4 text-yellow-500 inline ml-2" />
                  )}
                </CardTitle>
                <CardDescription>{planConfig?.description}</CardDescription>
              </div>
            </div>
            <Badge className={statusConfig.badge}>
              {statusConfig.icon}
              <span className="ml-2">{statusConfig.text}</span>
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Status Description */}
          <p className="text-sm text-gray-400">
            {statusConfig.description}
          </p>

          {/* Billing Information */}
          {showBilling && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-white">Billing</h4>
                <div className="space-y-1 text-sm text-gray-400">
                  <div className="flex items-center justify-between">
                    <span>Amount:</span>
                    <span className="text-white">
                      {pricingUtils.formatPrice(subscription.price)}/month
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Cycle:</span>
                    <span className="text-white capitalize">
                      {subscription.billingCycle}
                      {isYearly && (
                        <Badge className="ml-2 bg-green-900/20 text-green-400 border-green-500/30 text-xs">
                          Save 17%
                        </Badge>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Next billing:</span>
                    <span className="text-white">
                      {formatDate(subscription.currentPeriodEnd)}
                    </span>
                  </div>
                  {daysRemaining !== null && (
                    <div className="flex items-center justify-between">
                      <span>Days remaining:</span>
                      <span className={cn(
                        'text-white',
                        daysRemaining <= 7 && 'text-yellow-400',
                        daysRemaining <= 3 && 'text-red-400'
                      )}>
                        {daysRemaining} days
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium text-white">Account</h4>
                <div className="space-y-1 text-sm text-gray-400">
                  <div className="flex items-center justify-between">
                    <span>Created:</span>
                    <span className="text-white">
                      {formatDate(subscription.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Subscription ID:</span>
                    <span className="text-white text-xs font-mono">
                      {subscription.id?.substring(0, 12)}...
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Usage Information */}
          {showUsage && planConfig?.limits && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-white">Usage This Month</h4>
              <div className="space-y-4">
                <UsageBar
                  used={userUsage.resumes || 0}
                  limit={planConfig.limits.resumes}
                  label="Resumes Processed"
                  icon={<TrendingUp className="w-4 h-4 text-blue-400" />}
                />
                <UsageBar
                  used={userUsage.interviews || 0}
                  limit={planConfig.limits.interviews}
                  label="Interview Sessions"
                  icon={<Crown className="w-4 h-4 text-purple-400" />}
                />
                <UsageBar
                  used={userUsage.coverLetters || 0}
                  limit={planConfig.limits.coverLetters}
                  label="Cover Letters"
                  icon={<CheckCircle className="w-4 h-4 text-green-400" />}
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {showActions && (
            <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-700">
              {/* Plan Management */}
              {subscription.status === 'active' && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAction('upgrade', onPlanChange, 'upgrade')}
                    disabled={isLoading}
                  >
                    {isLoading && actionType === 'upgrade' ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <ArrowUpCircle className="w-4 h-4 mr-2" />
                    )}
                    Upgrade Plan
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAction('billing', onBillingChange, isYearly ? 'monthly' : 'yearly')}
                    disabled={isLoading}
                  >
                    {isLoading && actionType === 'billing' ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Calendar className="w-4 h-4 mr-2" />
                    )}
                    Switch to {isYearly ? 'Monthly' : 'Yearly'}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAction('payment', onUpdatePayment)}
                    disabled={isLoading}
                  >
                    {isLoading && actionType === 'payment' ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <CreditCard className="w-4 h-4 mr-2" />
                    )}
                    Update Payment
                  </Button>
                </>
              )}

              {/* Reactivation */}
              {subscription.status === 'cancelled' && (
                <Button
                  size="sm"
                  onClick={() => handleAction('reactivate', onReactivate)}
                  disabled={isLoading}
                >
                  {isLoading && actionType === 'reactivate' ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4 mr-2" />
                  )}
                  Reactivate Plan
                </Button>
              )}

              {/* Cancellation */}
              {subscription.status === 'active' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleAction('cancel', onCancel)}
                  disabled={isLoading}
                  className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                >
                  {isLoading && actionType === 'cancel' ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <XCircle className="w-4 h-4 mr-2" />
                  )}
                  Cancel Subscription
                </Button>
              )}

              {/* External Links */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open('/account/billing', '_blank')}
              >
                <Settings className="w-4 h-4 mr-2" />
                Billing Settings
                <ExternalLink className="w-3 h-3 ml-2" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SubscriptionStatus;

// Export for easier composition
export { SubscriptionStatus };