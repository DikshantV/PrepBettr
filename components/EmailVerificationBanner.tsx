"use client";

import React, { useState } from "react";
import { StickyBanner } from "@/components/ui/sticky-banner";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const EmailVerificationBanner = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  // Debug logging to verify user data in banner
  console.log('EmailVerificationBanner - user:', user);
  console.log('EmailVerificationBanner - user.emailVerified:', user?.emailVerified);

  // Only show banner if user exists and email is not verified
  const shouldShowBanner = user && !user.emailVerified;

  const handleVerifyClick = async () => {
    if (!user?.email || isLoading) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Verification email sent! Please check your inbox.');
      } else {
        toast.error(data.error || 'Failed to send verification email');
      }
    } catch (error) {
      console.error('Error sending verification email:', error);
      toast.error('Failed to send verification email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <StickyBanner
      showBanner={!!shouldShowBanner}
      message="Please verify your email to get full access to the features"
      hideOnScroll={true}
      className="bg-black"
    >
      <button
        onClick={handleVerifyClick}
        disabled={isLoading}
        className="ml-2 inline-flex items-center text-sm font-medium text-white hover:text-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Resend verification email"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ArrowRight className="h-4 w-4" />
        )}
      </button>
    </StickyBanner>
  );
};
