'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Zap, Building2, Crown, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { pricingUtils } from '@/lib/pricing-config';

/**
 * PlanSelector - Reusable component for displaying and selecting subscription plans
 * 
 * @param {Object} props
 * @param {Array} props.plans - Array of plan objects to display
 * @param {string} props.selectedPlan - Currently selected plan ID
 * @param {Function} props.onPlanSelect - Callback when plan is selected
 * @param {boolean} props.isYearly - Whether yearly billing is selected
 * @param {boolean} props.showComparison - Whether to show plan comparison features
 * @param {boolean} props.interactive - Whether plans are clickable for selection
 * @param {string} props.size - Size variant: 'sm', 'md', 'lg'
 * @param {string} props.layout - Layout variant: 'grid', 'row', 'compact'
 * @param {Object} props.customFeatures - Custom features to override plan features
 * @param {string} props.className - Additional CSS classes
 */
const PlanSelector = ({
  plans = [],
  selectedPlan = null,
  onPlanSelect = () => {},
  isYearly = false,
  showComparison = false,
  interactive = true,
  size = 'md',
  layout = 'grid',
  customFeatures = {},
  className = '',
  highlightPopular = true,
  showTrialInfo = true,
  showSavingsBadge = true
}) => {
  const [hoveredPlan, setHoveredPlan] = useState(null);

  // Icon mapping
  const iconMap = {
    zap: <Zap className="h-8 w-8 text-primary-200" />,
    building2: <Building2 className="h-8 w-8 text-primary-200" />,
    star: <Star className="h-8 w-8 text-primary-200" />
  };

  // Size configurations
  const sizeConfig = {
    sm: {
      card: 'p-4',
      title: 'text-lg',
      price: 'text-2xl',
      description: 'text-sm',
      feature: 'text-xs'
    },
    md: {
      card: 'p-6',
      title: 'text-xl',
      price: 'text-4xl',
      description: 'text-base',
      feature: 'text-sm'
    },
    lg: {
      card: 'p-8',
      title: 'text-2xl',
      price: 'text-5xl',
      description: 'text-lg',
      feature: 'text-base'
    }
  };

  const currentSizeConfig = sizeConfig[size] || sizeConfig.md;

  // Layout configurations
  const layoutConfig = {
    grid: 'grid gap-6',
    row: 'flex flex-wrap gap-4',
    compact: 'space-y-4'
  };

  // Get pricing for billing cycle
  const getPlanPricing = (plan) => {
    const billing = isYearly ? 'yearly' : 'monthly';
    return plan.pricing[billing];
  };

  // Format price display
  const formatPriceDisplay = (plan) => {
    const pricing = getPlanPricing(plan);
    if (isYearly) {
      return {
        price: pricingUtils.formatPrice(pricing.monthlyEquivalent),
        period: '/month',
        billedText: `Billed ${pricingUtils.formatPrice(pricing.amount)} annually`,
        savings: pricing.savings
      };
    }
    return {
      price: pricingUtils.formatPrice(pricing.amount),
      period: '/month',
      billedText: 'Billed monthly',
      savings: null
    };
  };

  // Handle plan selection
  const handlePlanClick = (planId) => {
    if (interactive && onPlanSelect) {
      onPlanSelect(planId);
    }
  };

  // Render individual plan card
  const PlanCard = ({ plan }) => {
    const isSelected = selectedPlan === plan.id;
    const isHovered = hoveredPlan === plan.id;
    const isPopular = plan.popular && highlightPopular;
    const pricing = formatPriceDisplay(plan);
    const features = customFeatures[plan.id] || plan.features;

    return (
      <Card 
        className={cn(
          'relative overflow-hidden transition-all duration-300',
          'bg-gray-900/50 border-gray-700 backdrop-blur-sm',
          interactive && 'cursor-pointer hover:scale-105 hover:shadow-lg',
          isSelected && 'ring-2 ring-primary-200/50 border-primary-200/50',
          isPopular && 'ring-2 ring-primary-200/30 scale-105',
          className
        )}
        onClick={() => handlePlanClick(plan.id)}
        onMouseEnter={() => setHoveredPlan(plan.id)}
        onMouseLeave={() => setHoveredPlan(null)}
      >
        {/* Popular Badge */}
        {isPopular && (
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
            <Badge className="bg-primary-200 text-dark-100 px-3 py-1 font-semibold">
              <Crown className="w-3 h-3 mr-1" />
              Most Popular
            </Badge>
          </div>
        )}

        {/* Selection Indicator */}
        {isSelected && (
          <div className="absolute top-4 right-4 z-10">
            <div className="bg-primary-200 rounded-full p-1">
              <CheckCircle className="w-4 h-4 text-dark-100" />
            </div>
          </div>
        )}

        <CardHeader className={cn('text-center pb-4', currentSizeConfig.card)}>
          {/* Icon */}
          <div className="flex justify-center mb-3">
            {iconMap[plan.icon] || iconMap.star}
          </div>

          {/* Plan Name */}
          <CardTitle className={cn('font-bold text-white mb-2', currentSizeConfig.title)}>
            {plan.name}
          </CardTitle>

          {/* Description */}
          <CardDescription className={cn('text-gray-400', currentSizeConfig.description)}>
            {plan.description}
          </CardDescription>
        </CardHeader>

        <CardContent className={cn('px-6 pb-6', currentSizeConfig.card)}>
          {/* Pricing Section */}
          <div className="text-center mb-6 p-4 bg-dark-300/30 rounded-xl">
            <div className="flex items-baseline justify-center mb-2">
              <span className={cn('font-bold text-white', currentSizeConfig.price)}>
                {pricing.price}
              </span>
              <span className="text-gray-400 ml-2">{pricing.period}</span>
            </div>
            
            <p className="text-sm text-gray-400 mb-2">
              {pricing.billedText}
            </p>

            {/* Savings Badge */}
            {pricing.savings && showSavingsBadge && (
              <Badge variant="outline" className="bg-green-900/20 text-green-400 border-green-500/30">
                Save {pricing.savings}% yearly
              </Badge>
            )}

            {/* Trial Info */}
            {plan.trial?.enabled && showTrialInfo && (
              <p className="text-xs text-gray-500 mt-2">
                {plan.trial.duration}-day free trial included
              </p>
            )}
          </div>

          {/* Features List */}
          {features && features.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold text-white text-sm mb-3">Features:</h4>
              {features.slice(0, showComparison ? features.length : 6).map((feature, index) => (
                <div key={index} className="flex items-start">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 shrink-0" />
                  <span className={cn('text-gray-300 leading-relaxed', currentSizeConfig.feature)}>
                    {feature}
                  </span>
                </div>
              ))}
              
              {!showComparison && features.length > 6 && (
                <div className="text-center pt-2">
                  <p className="text-primary-200 text-xs font-medium">
                    + {features.length - 6} more features
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Usage Limits */}
          {plan.limits && size !== 'sm' && (
            <div className="mt-4 pt-4 border-t border-gray-700">
              <h4 className="font-semibold text-white text-xs mb-2">Usage Limits:</h4>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
                {Object.entries(plan.limits).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="capitalize">{key}:</span>
                    <span className="text-white">{value === -1 ? 'Unlimited' : value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // Determine grid columns based on number of plans
  const getGridCols = () => {
    if (layout !== 'grid') return '';
    const planCount = plans.length;
    if (planCount === 1) return 'grid-cols-1 max-w-md mx-auto';
    if (planCount === 2) return 'md:grid-cols-2 max-w-4xl mx-auto';
    if (planCount === 3) return 'md:grid-cols-3 max-w-6xl mx-auto';
    return 'md:grid-cols-2 lg:grid-cols-3 max-w-7xl mx-auto';
  };

  if (!plans || plans.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">No plans available</p>
      </div>
    );
  }

  return (
    <div className={cn(
      layoutConfig[layout],
      getGridCols(),
      className
    )}>
      {plans.map((plan) => (
        <PlanCard key={plan.id} plan={plan} />
      ))}
    </div>
  );
};

export default PlanSelector;

// Export for easier composition
export { PlanSelector };