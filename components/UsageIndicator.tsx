"use client";

import { useUsage } from "@/contexts/UsageContext";
import { UserUsageCounters } from "@/types/subscription";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader } from "lucide-react";

interface UsageIndicatorProps {
  feature?: keyof UserUsageCounters;
  variant?: "compact" | "full" | "badge";
  showLabel?: boolean;
  className?: string;
}

export function UsageIndicator({ 
  feature, 
  variant = "compact", 
  showLabel = true,
  className = ""
}: UsageIndicatorProps) {
  const { usage, loading, error, getRemainingCount } = useUsage();

  if (loading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Loader className="h-3 w-3 animate-spin" />
        {showLabel && variant !== "badge" && (
          <span className="text-xs text-muted-foreground">Loading...</span>
        )}
      </div>
    );
  }

  if (error || !usage) {
    return variant === "badge" ? (
      <Badge variant="destructive" className="text-xs">
        Error
      </Badge>
    ) : null;
  }

  // Helper function to get feature display name
  const getFeatureName = (featureKey: keyof UserUsageCounters): string => {
    const names = {
      interviews: "Interviews",
      resumeTailor: "Resume Tailor", 
      autoApply: "Auto Apply"
    };
    return names[featureKey];
  };

  // Helper function to calculate progress percentage
  const getProgressPercentage = (featureKey: keyof UserUsageCounters): number => {
    const counter = usage[featureKey];
    if (counter.limit === -1) return 0; // Unlimited
    if (counter.limit === 0) return 0;
    return Math.min(100, (counter.count / counter.limit) * 100);
  };

  // Helper function to get status color
  const getStatusColor = (featureKey: keyof UserUsageCounters): string => {
    const counter = usage[featureKey];
    const remaining = getRemainingCount(featureKey);
    
    if (counter.limit === -1) return "text-green-600";
    if (remaining === 0) return "text-red-600";
    if (remaining <= 1) return "text-orange-600";
    return "text-blue-600";
  };

  // Single feature display
  if (feature) {
    const counter = usage[feature];
    const remaining = getRemainingCount(feature);
    const percentage = getProgressPercentage(feature);
    const statusColor = getStatusColor(feature);

    if (variant === "badge") {
      if (counter.limit === -1) {
        return <Badge variant="default" className="text-xs bg-green-100 text-green-800">Unlimited</Badge>;
      }
      if (remaining === 0) {
        return <Badge variant="destructive" className="text-xs">0 left</Badge>;
      }
      return <Badge variant="outline" className="text-xs border-2 border-gray-300 dark:border-gray-600">{remaining} left</Badge>;
    }

    if (variant === "compact") {
      return (
        <div className={`flex items-center gap-2 min-w-0 ${className}`}>
          {showLabel && (
            <span className="text-xs font-medium truncate">
              {getFeatureName(feature)}:
            </span>
          )}
          <div className="flex items-center gap-1 min-w-0">
            {counter.limit === -1 ? (
              <Badge variant="default" className="text-xs bg-green-100 text-green-800 px-2">
                ∞
              </Badge>
            ) : (
              <>
                <Progress 
                  value={percentage} 
                  className="w-16 h-2" 
                  indicatorClassName={
                    remaining === 0 ? "bg-red-500" :
                    remaining <= 1 ? "bg-orange-500" : "bg-blue-500"
                  }
                />
                <span className={`text-xs font-medium ${statusColor} whitespace-nowrap`}>
                  {remaining}
                </span>
              </>
            )}
          </div>
        </div>
      );
    }

    // Full variant
    return (
      <div className={`space-y-2 ${className}`}>
        {showLabel && (
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">{getFeatureName(feature)}</span>
            <span className={`text-sm ${statusColor}`}>
              {counter.limit === -1 ? "Unlimited" : `${counter.count}/${counter.limit}`}
            </span>
          </div>
        )}
        {counter.limit !== -1 && (
          <Progress 
            value={percentage} 
            className="w-full h-2"
            indicatorClassName={
              remaining === 0 ? "bg-red-500" :
              remaining <= 1 ? "bg-orange-500" : "bg-blue-500"
            }
          />
        )}
        <div className="flex justify-between items-center text-xs text-muted-foreground">
          <span>Used: {counter.count}</span>
          <span>
            Remaining: {counter.limit === -1 ? "Unlimited" : remaining}
          </span>
        </div>
      </div>
    );
  }

  // All features compact display
  if (variant === "compact") {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        {Object.entries(usage).map(([key, counter]) => {
          const featureKey = key as keyof UserUsageCounters;
          const remaining = getRemainingCount(featureKey);
          const percentage = getProgressPercentage(featureKey);
          const statusColor = getStatusColor(featureKey);
          
          return (
            <div key={key} className="flex items-center gap-1 min-w-0">
              <span className="text-xs text-muted-foreground truncate">
                {getFeatureName(featureKey)}:
              </span>
              {counter.limit === -1 ? (
                <Badge variant="default" className="text-xs bg-green-100 text-green-800 px-2">
                  ∞
                </Badge>
              ) : (
                <>
                  <Progress 
                    value={percentage} 
                    className="w-12 h-1.5" 
                    indicatorClassName={
                      remaining === 0 ? "bg-red-500" :
                      remaining <= 1 ? "bg-orange-500" : "bg-blue-500"
                    }
                  />
                  <span className={`text-xs ${statusColor}`}>
                    {remaining}
                  </span>
                </>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return null;
}
