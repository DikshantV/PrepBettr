"use client";

import { ReactNode, useState } from "react";
import { useUsage } from "@/contexts/UsageContext";
import { UserUsageCounters } from "@/types/subscription";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Zap, Crown } from "lucide-react";

interface RequireQuotaProps {
  feature: keyof UserUsageCounters;
  children: ReactNode;
  fallback?: ReactNode;
  showUsage?: boolean;
}

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature: keyof UserUsageCounters;
  remaining: number;
}

function UpgradeModal({ isOpen, onClose, feature, remaining }: UpgradeModalProps) {
  const getFeatureName = (featureKey: keyof UserUsageCounters): string => {
    const names = {
      interviews: "Interview",
      resumeTailor: "Resume Tailor", 
      autoApply: "Auto Apply"
    };
    return names[featureKey];
  };

  const handleUpgrade = () => {
    // Redirect to pricing or payment page
    window.location.href = "/api/payments/create-checkout";
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-yellow-500" />
            Upgrade to Premium
          </DialogTitle>
          <DialogDescription>
            You've reached your {getFeatureName(feature).toLowerCase()} usage limit.
            {remaining === 0 
              ? " Upgrade to Premium for unlimited access."
              : ` You have ${remaining} use${remaining === 1 ? '' : 's'} remaining.`
            }
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 p-4 rounded-lg">
            <h4 className="font-semibold flex items-center gap-2 mb-3">
              <Zap className="h-4 w-4 text-yellow-500" />
              Premium Benefits
            </h4>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 bg-green-500 rounded-full flex-shrink-0"></div>
                <span>Unlimited interviews with AI feedback</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 bg-green-500 rounded-full flex-shrink-0"></div>
                <span>Unlimited resume tailoring & optimization</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 bg-green-500 rounded-full flex-shrink-0"></div>
                <span>Unlimited auto-apply job applications</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 bg-green-500 rounded-full flex-shrink-0"></div>
                <span>Priority customer support</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 bg-green-500 rounded-full flex-shrink-0"></div>
                <span>Advanced analytics & insights</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 bg-green-500 rounded-full flex-shrink-0"></div>
                <span>Custom interview prep materials</span>
              </li>
            </ul>
          </div>
          
          <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
            <p className="font-medium mb-1">Current usage for {getFeatureName(feature)}:</p>
            <Badge variant={remaining === 0 ? "destructive" : "secondary"} className="mt-1">
              {remaining === 0 ? "Limit Reached" : `${remaining} remaining`}
            </Badge>
          </div>
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
          <Button variant="outline" onClick={onClose}>
            Not now
          </Button>
          <Button onClick={handleUpgrade} className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
            <Crown className="h-4 w-4 mr-2" />
            Upgrade to Premium
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RequireQuota({ 
  feature, 
  children, 
  fallback,
  showUsage = false 
}: RequireQuotaProps) {
  const { canUseFeature, getRemainingCount, usage, loading } = useUsage();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const remaining = getRemainingCount(feature);
  const canUse = canUseFeature(feature);

  if (loading) {
    return (
      <div className="opacity-50 pointer-events-none">
        {children}
      </div>
    );
  }

  // If user can use the feature, render children normally
  if (canUse) {
    return (
      <>
        {showUsage && usage && (
          <Badge variant="outline" className="text-xs mb-2">
            {remaining === Infinity ? "Unlimited" : `${remaining} remaining`}
          </Badge>
        )}
        {children}
      </>
    );
  }

  // If fallback is provided and user can't use feature, show fallback
  if (fallback) {
    return <>{fallback}</>;
  }

  // Default: render disabled version with upgrade prompt
  return (
    <>
      <div 
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setShowUpgradeModal(true);
        }}
        className="cursor-pointer relative"
      >
        <div className="opacity-50 pointer-events-none">
          {children}
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-black/10 rounded-lg">
          <Badge variant="secondary" className="text-xs">
            <Crown className="h-3 w-3 mr-1" />
            Upgrade
          </Badge>
        </div>
      </div>
      
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        feature={feature}
        remaining={remaining}
      />
    </>
  );
}
