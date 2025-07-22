"use client";

import { useUsage } from "@/contexts/UsageContext";
import { Badge } from "@/components/ui/badge";
import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { UserUsageCounters } from "@/types/subscription";

interface PremiumBadgeProps {
  feature?: keyof UserUsageCounters;
  variant?: "default" | "outline" | "secondary" | "destructive";
  size?: "sm" | "default" | "lg";
  className?: string;
  showIcon?: boolean;
  onClick?: () => void;
}

export function PremiumBadge({ 
  feature,
  variant = "secondary",
  size = "sm",
  className,
  showIcon = true,
  onClick
}: PremiumBadgeProps) {
  const { usage, loading, canUseFeature } = useUsage();

  // Show loading state
  if (loading) {
    return (
      <Badge 
        variant="outline" 
        className={cn("animate-pulse bg-muted", className)}
      >
        Loading...
      </Badge>
    );
  }

  // If no usage data, assume free user
  if (!usage) {
    return (
      <Badge 
        variant={variant}
        className={cn(
          "text-xs font-medium cursor-pointer",
          "bg-gradient-to-r from-purple-500 to-blue-500 text-white border-0",
          "hover:from-purple-600 hover:to-blue-600 transition-all",
          className
        )}
        onClick={onClick}
      >
        {showIcon && <Crown className="h-3 w-3 mr-1" />}
        Premium
      </Badge>
    );
  }

  // If feature is specified, check if user can use it
  if (feature) {
    const canUse = canUseFeature(feature);
    if (canUse) {
      return null; // Don't show badge if user can use the feature
    }
  } else {
    // If no feature specified, check if user is on premium plan
    const isPremium = Object.values(usage).every(counter => counter.limit === -1);
    if (isPremium) {
      return null; // Don't show badge for premium users
    }
  }

  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5",
    default: "text-sm px-2 py-1",
    lg: "text-base px-3 py-1.5"
  };

  const iconSizes = {
    sm: "h-3 w-3",
    default: "h-4 w-4", 
    lg: "h-5 w-5"
  };

  return (
    <Badge 
      variant={variant}
      className={cn(
        "font-medium cursor-pointer",
        "bg-gradient-to-r from-purple-500 to-blue-500 text-white border-0",
        "hover:from-purple-600 hover:to-blue-600 transition-all",
        sizeClasses[size],
        className
      )}
      onClick={onClick}
    >
      {showIcon && <Crown className={cn(iconSizes[size], "mr-1")} />}
      Premium
    </Badge>
  );
}

// Helper component for wrapping features with premium badges
interface PremiumFeatureWrapperProps {
  feature: keyof UserUsageCounters;
  children: React.ReactNode;
  badgePosition?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  className?: string;
}

export function PremiumFeatureWrapper({ 
  feature, 
  children, 
  badgePosition = "top-right",
  className 
}: PremiumFeatureWrapperProps) {
  const { canUseFeature } = useUsage();
  
  const canUse = canUseFeature(feature);
  
  if (canUse) {
    return <>{children}</>;
  }

  const positionClasses = {
    "top-left": "top-2 left-2",
    "top-right": "top-2 right-2", 
    "bottom-left": "bottom-2 left-2",
    "bottom-right": "bottom-2 right-2"
  };

  const handleUpgrade = () => {
    window.location.href = "/api/payments/create-checkout";
  };

  return (
    <div className={cn("relative", className)}>
      {children}
      <div className={cn("absolute z-10", positionClasses[badgePosition])}>
        <PremiumBadge 
          feature={feature} 
          onClick={handleUpgrade}
        />
      </div>
    </div>
  );
}
