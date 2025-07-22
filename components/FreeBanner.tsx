"use client";

import { useUsage } from "@/contexts/UsageContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, Zap, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface FreeBannerProps {
  className?: string;
}

export function FreeBanner({ className }: FreeBannerProps) {
  const { usage, loading } = useUsage();
  const [dismissed, setDismissed] = useState(false);

  // Don't show banner if loading, dismissed, or user has unlimited features (premium)
  if (loading || dismissed || !usage) {
    return null;
  }

  // Check if user is on free plan (has any limited features)
  const isFreeUser = Object.values(usage).some(counter => counter.limit !== -1);
  
  if (!isFreeUser) {
    return null;
  }

  // Calculate usage percentage across all features
  const totalUsed = Object.values(usage).reduce((acc, counter) => {
    if (counter.limit === -1) return acc; // Skip unlimited features
    return acc + counter.count;
  }, 0);

  const totalLimit = Object.values(usage).reduce((acc, counter) => {
    if (counter.limit === -1) return acc; // Skip unlimited features
    return acc + counter.limit;
  }, 0);

  const usagePercentage = totalLimit > 0 ? (totalUsed / totalLimit) * 100 : 0;

  return (
    <div 
      className={cn(
        "relative bg-gradient-to-r from-purple-600/90 to-blue-600/90 backdrop-blur-sm border border-purple-500/20 rounded-lg p-4 mb-6",
        "dark:from-purple-900/90 dark:to-blue-900/90 dark:border-purple-400/20",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 bg-white/20 rounded-full">
            <Crown className="h-5 w-5 text-yellow-300" />
          </div>
          
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-white">Free Plan</h3>
              <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                {Math.round(usagePercentage)}% used
              </Badge>
            </div>
            <p className="text-sm text-white/80">
              You're currently using the free plan with access to all features.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setDismissed(true)}
            className="p-1 text-white/60 hover:text-white/80 transition-colors"
            aria-label="Dismiss banner"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Usage progress bar */}
      {usagePercentage > 0 && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-white/70 mb-1">
            <span>Overall usage</span>
            <span>{totalUsed}/{totalLimit} features used</span>
          </div>
          <div className="w-full bg-white/20 rounded-full h-2">
            <div 
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                usagePercentage >= 80 ? "bg-red-400" : 
                usagePercentage >= 60 ? "bg-yellow-400" : "bg-green-400"
              )}
              style={{ width: `${Math.min(usagePercentage, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
