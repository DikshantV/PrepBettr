import { UserUsageCounters } from "@/types/subscription";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface UsageDisplayServerProps {
  usage: UserUsageCounters | null;
  feature?: keyof UserUsageCounters;
  variant?: "compact" | "detailed";
  showTitle?: boolean;
}

export function UsageDisplayServer({ 
  usage,
  feature, 
  variant = "compact", 
  showTitle = true 
}: UsageDisplayServerProps) {
  if (!usage) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">No usage data available</span>
      </div>
    );
  }

  // Helper function to get remaining count
  const getRemainingCount = (featureKey: keyof UserUsageCounters): number => {
    const counter = usage[featureKey];
    if (counter.limit === -1) return Infinity; // Unlimited
    return Math.max(0, counter.limit - counter.count);
  };

  // Helper function to get feature display name
  const getFeatureName = (featureKey: keyof UserUsageCounters): string => {
    const names = {
      interviews: "Interviews",
      resumeTailor: "Resume Tailor", 
      autoApply: "Auto Apply",
      coverLetterGenerator: "Cover Letter Generator",
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
