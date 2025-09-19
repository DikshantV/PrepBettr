'use client';

import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Sparkles, TrendingUp, Gift, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * PricingToggle - Reusable component for monthly/yearly billing toggle
 * 
 * @param {Object} props
 * @param {boolean} props.isYearly - Current state (true for yearly, false for monthly)
 * @param {Function} props.onToggle - Callback when toggle changes
 * @param {number} props.savingsPercentage - Percentage savings for yearly
 * @param {string} props.savingsAmount - Formatted savings amount
 * @param {string} props.size - Size variant: 'sm', 'md', 'lg'
 * @param {string} props.variant - Style variant: 'default', 'compact', 'detailed'
 * @param {boolean} props.showSavings - Whether to show savings information
 * @param {string} props.className - Additional CSS classes
 * @param {Object} props.customLabels - Custom labels for monthly/yearly
 */
const PricingToggle = ({
  isYearly = false,
  onToggle = () => {},
  savingsPercentage = 17,
  savingsAmount = null,
  size = 'md',
  variant = 'default',
  showSavings = true,
  className = '',
  customLabels = {
    monthly: 'Monthly',
    yearly: 'Yearly',
    savingsText: 'Save {percentage}%'
  },
  disabled = false,
  showIcons = true,
  animatedSavings = true
}) => {
  // Size configurations
  const sizeConfig = {
    sm: {
      text: 'text-sm font-medium',
      badge: 'text-xs px-2 py-1',
      icon: 'w-3 h-3',
      spacing: 'space-x-3'
    },
    md: {
      text: 'text-lg font-medium',
      badge: 'text-xs px-2 py-1',
      icon: 'w-4 h-4',
      spacing: 'space-x-4'
    },
    lg: {
      text: 'text-xl font-semibold',
      badge: 'text-sm px-3 py-1.5',
      icon: 'w-5 h-5',
      spacing: 'space-x-6'
    }
  };

  const currentSizeConfig = sizeConfig[size] || sizeConfig.md;

  // Handle toggle change
  const handleToggleChange = (checked) => {
    if (!disabled) {
      onToggle(checked);
    }
  };

  // Render savings badge
  const SavingsBadge = () => {
    if (!showSavings) return null;

    const savingsText = customLabels.savingsText.replace('{percentage}', savingsPercentage);

    return (
      <Badge 
        className={cn(
          'bg-green-900/20 text-green-400 border-green-500/30',
          currentSizeConfig.badge,
          animatedSavings && isYearly && 'animate-pulse'
        )}
      >
        {showIcons && <Sparkles className={cn('mr-1', currentSizeConfig.icon)} />}
        {savingsText}
      </Badge>
    );
  };

  // Render additional savings info
  const SavingsInfo = () => {
    if (!showSavings || !savingsAmount || variant === 'compact') return null;

    return (
      <div className="text-center mt-2">
        <p className="text-xs text-green-400 flex items-center justify-center">
          {showIcons && <Gift className={cn('mr-1', currentSizeConfig.icon)} />}
          Save {savingsAmount} annually
        </p>
      </div>
    );
  };

  // Compact variant
  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center justify-center', currentSizeConfig.spacing, className)}>
        <span className={cn(
          'transition-colors',
          currentSizeConfig.text,
          !isYearly ? 'text-white' : 'text-gray-400'
        )}>
          {customLabels.monthly}
        </span>
        
        <div className="relative">
          <Switch
            checked={isYearly}
            onCheckedChange={handleToggleChange}
            disabled={disabled}
            className="data-[state=checked]:bg-primary-200"
          />
        </div>
        
        <div className="flex items-center space-x-2">
          <span className={cn(
            'transition-colors',
            currentSizeConfig.text,
            isYearly ? 'text-white' : 'text-gray-400'
          )}>
            {customLabels.yearly}
          </span>
          <SavingsBadge />
        </div>
      </div>
    );
  }

  // Detailed variant
  if (variant === 'detailed') {
    return (
      <div className={cn('text-center space-y-4', className)}>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-white">Choose billing cycle</h3>
          <p className="text-sm text-gray-400">
            Switch to yearly billing and save money
          </p>
        </div>

        <div className={cn('flex items-center justify-center', currentSizeConfig.spacing)}>
          {/* Monthly Option */}
          <div className="text-center space-y-2">
            <div className={cn(
              'flex items-center justify-center space-x-2 p-3 rounded-lg border transition-all',
              !isYearly 
                ? 'border-primary-200/50 bg-primary-200/10' 
                : 'border-gray-700 hover:border-gray-600 cursor-pointer'
            )} onClick={() => handleToggleChange(false)}>
              {showIcons && <Calendar className={cn(currentSizeConfig.icon, 'text-primary-200')} />}
              <span className={cn(
                currentSizeConfig.text,
                !isYearly ? 'text-white' : 'text-gray-400'
              )}>
                {customLabels.monthly}
              </span>
            </div>
            <p className="text-xs text-gray-500">Billed monthly</p>
          </div>

          {/* Toggle Switch */}
          <div className="mx-4">
            <Switch
              checked={isYearly}
              onCheckedChange={handleToggleChange}
              disabled={disabled}
              className="data-[state=checked]:bg-primary-200"
            />
          </div>

          {/* Yearly Option */}
          <div className="text-center space-y-2">
            <div className={cn(
              'flex items-center justify-center space-x-2 p-3 rounded-lg border transition-all',
              isYearly 
                ? 'border-primary-200/50 bg-primary-200/10' 
                : 'border-gray-700 hover:border-gray-600 cursor-pointer'
            )} onClick={() => handleToggleChange(true)}>
              {showIcons && <TrendingUp className={cn(currentSizeConfig.icon, 'text-primary-200')} />}
              <span className={cn(
                currentSizeConfig.text,
                isYearly ? 'text-white' : 'text-gray-400'
              )}>
                {customLabels.yearly}
              </span>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-gray-500">Billed annually</p>
              <SavingsBadge />
            </div>
          </div>
        </div>

        <SavingsInfo />
      </div>
    );
  }

  // Default variant
  return (
    <div className={cn('text-center space-y-4', className)}>
      {/* Toggle Controls */}
      <div className={cn('flex items-center justify-center', currentSizeConfig.spacing)}>
        <span className={cn(
          'transition-colors',
          currentSizeConfig.text,
          !isYearly ? 'text-white' : 'text-gray-400'
        )}>
          {showIcons && <Calendar className={cn('inline mr-2', currentSizeConfig.icon)} />}
          {customLabels.monthly}
        </span>
        
        <div className="relative">
          <Switch
            checked={isYearly}
            onCheckedChange={handleToggleChange}
            disabled={disabled}
            className="data-[state=checked]:bg-primary-200"
          />
        </div>
        
        <div className="flex items-center space-x-2">
          <span className={cn(
            'transition-colors',
            currentSizeConfig.text,
            isYearly ? 'text-white' : 'text-gray-400'
          )}>
            {showIcons && <TrendingUp className={cn('inline mr-2', currentSizeConfig.icon)} />}
            {customLabels.yearly}
          </span>
          <SavingsBadge />
        </div>
      </div>

      <SavingsInfo />

      {/* Additional Information */}
      {variant === 'default' && (
        <p className="text-xs text-gray-500 max-w-md mx-auto">
          Choose yearly billing to get the same great features at a lower monthly cost. 
          You can change your billing cycle anytime.
        </p>
      )}
    </div>
  );
};

export default PricingToggle;

// Export for easier composition
export { PricingToggle };