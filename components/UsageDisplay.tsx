"use client";

import { useUsage } from "@/contexts/UsageContext";
import { UserUsageCounters } from "@/types/subscription";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader } from "lucide-react";

interface UsageDisplayProps {
  feature?: keyof UserUsageCounters;
  variant?: "compact" | "detailed";
  showTitle?: boolean;
}

export function UsageDisplay({ 
  feature, 
  variant = "compact", 
  showTitle = true 
}: UsageDisplayProps) {
  const { usage, loading, error, getRemainingCount } = useUsage();

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <Loader className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Loading usage...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Badge variant="destructive" className="text-xs">
        Error loading usage
      </Badge>
    );
  }

  if (!usage) {
    return null;
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

  // Helper function to get usage status badge
  const getUsageBadge = (featureKey: keyof UserUsageCounters) => {
    const counter = usage[featureKey];
    const remaining = getRemainingCount(featureKey);
    
    if (counter.limit === -1) {
      return <Badge variant="default" className="text-xs">Unlimited</Badge>;
    }
    
    if (remaining === 0) {
      return <Badge variant="destructive" className="text-xs">Limit Reached</Badge>;
    }
    
    if (remaining <= 1) {
      return <Badge variant="secondary" className="text-xs">{remaining} left</Badge>;
    }
    
    return <Badge variant="outline" className="text-xs">{remaining} remaining</Badge>;
  };

  // Single feature display
  if (feature) {
    const counter = usage[feature];
    const remaining = getRemainingCount(feature);
    
    if (variant === "compact") {
      return (
        <div className="flex items-center gap-2">
          {showTitle && (
            <span className="text-sm font-medium">{getFeatureName(feature)}:</span>
          )}
          {getUsageBadge(feature)}
        </div>
      );
    }

    return (
      <Card className="w-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">{getFeatureName(feature)}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Used:</span>
              <span className="font-medium">{counter.count}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Limit:</span>
              <span className="font-medium">
                {counter.limit === -1 ? "Unlimited" : counter.limit}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Remaining:</span>
              <span className="font-medium">
                {counter.limit === -1 ? "Unlimited" : remaining}
              </span>
            </div>
            {getUsageBadge(feature)}
          </div>
        </CardContent>
      </Card>
    );
  }

  // All features display
  if (variant === "compact") {
    return (
      <div className="flex flex-wrap gap-2">
        {Object.entries(usage).map(([key, counter]) => (
          <div key={key} className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">
              {getFeatureName(key as keyof UserUsageCounters)}:
            </span>
            {getUsageBadge(key as keyof UserUsageCounters)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {Object.entries(usage).map(([key, counter]) => (
        <Card key={key}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {getFeatureName(key as keyof UserUsageCounters)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Used:</span>
                <span className="font-medium">{counter.count}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Limit:</span>
                <span className="font-medium">
                  {counter.limit === -1 ? "Unlimited" : counter.limit}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Remaining:</span>
                <span className="font-medium">
                  {counter.limit === -1 ? "Unlimited" : getRemainingCount(key as keyof UserUsageCounters)}
                </span>
              </div>
              {getUsageBadge(key as keyof UserUsageCounters)}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
