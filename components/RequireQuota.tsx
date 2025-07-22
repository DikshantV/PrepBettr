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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-yellow-500" />
            Feature Usage Information
          </DialogTitle>
          <DialogDescription>
            {remaining === 0 
              ? `You've reached your ${getFeatureName(feature).toLowerCase()} usage limit for today.`
              : `You have ${remaining} use${remaining === 1 ? '' : 's'} remaining for ${getFeatureName(feature).toLowerCase()}.`
            }
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
            <p className="font-medium mb-1">Current usage for {getFeatureName(feature)}:</p>
            <Badge variant={remaining === 0 ? "destructive" : "secondary"} className="mt-1">
              {remaining === 0 ? "Limit Reached" : `${remaining} remaining`}
            </Badge>
          </div>
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
          <Button onClick={onClose}>
            OK
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

  // Default: render disabled version with info modal
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
            Limit Reached
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
