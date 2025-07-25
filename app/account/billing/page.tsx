"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { UsageIndicator } from "@/components/UsageIndicator";
import { useAuth } from "@/contexts/AuthContext";
import { useUsage } from "@/contexts/UsageContext";
import { UserSubscriptionFields } from "@/types/subscription";
import { 
  CreditCard, 
  Settings, 
  Crown, 
  Calendar,
  ArrowLeft,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import BanterLoader from "@/components/ui/BanterLoader";
import { toast } from "sonner";

export default function BillingPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { usage, loading: usageLoading } = useUsage();
  const [subscription, setSubscription] = useState<UserSubscriptionFields | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [managingSubscription, setManagingSubscription] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/sign-in");
      return;
    }

    fetchSubscription();
  }, [isAuthenticated, router]);

  const fetchSubscription = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/subscription/current");
      
      if (response.ok) {
        const data = await response.json();
        setSubscription(data.subscription);
      } else {
        console.error("Failed to fetch subscription");
        toast.error("Failed to load subscription information");
      }
    } catch (error) {
      console.error("Error fetching subscription:", error);
      toast.error("Error loading subscription information");
    } finally {
      setLoading(false);
    }
  };

  const handleUpgradeToPremium = async () => {
    if (!user) return;

    try {
      setUpgrading(true);
      const response = await fetch("/api/payments/create-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uid: user.id,
        }),
      });

      const data = await response.json();

      if (response.ok && data.checkoutUrl) {
        // Redirect to Dodo checkout
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error(data.error || "Failed to create checkout session");
      }
    } catch (error) {
      console.error("Error creating checkout:", error);
      toast.error("Failed to start upgrade process. Please try again.");
    } finally {
      setUpgrading(false);
    }
  };

  const handleManageSubscription = async () => {
    if (!user || !subscription?.dodoCustomerId) return;

    try {
      setManagingSubscription(true);
      const response = await fetch("/api/payments/portal-link");

      const data = await response.json();

      if (response.ok && data.portalUrl) {
        // Redirect to Dodo customer portal
        window.location.href = data.portalUrl;
      } else {
        throw new Error(data.error || "Failed to create portal session");
      }
    } catch (error) {
      console.error("Error creating portal session:", error);
      toast.error("Failed to open subscription management. Please try again.");
    } finally {
      setManagingSubscription(false);
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "N/A";
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(date));
  };

  const getPlanBadgeVariant = (plan: string) => {
    return plan === "premium" ? "default" : "secondary";
  };

  const getPlanIcon = (plan: string) => {
    return plan === "premium" ? <Crown className="h-4 w-4" /> : null;
  };

  if (loading || usageLoading) {
    return (
      <div className="container max-w-4xl mx-auto py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <BanterLoader />
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Billing & Subscription</h1>
        <p className="text-white">
          Manage your subscription and view usage statistics
        </p>
      </div>

      <div className="grid gap-6">
        {/* Current Plan Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {subscription && getPlanIcon(subscription.plan)}
              Current Plan
            </CardTitle>
            <CardDescription>
              Your current subscription plan and status
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge variant={getPlanBadgeVariant(subscription?.plan || "free")}>
                  {subscription?.plan?.toUpperCase() || "FREE"}
                </Badge>
                {subscription?.planStatus === "active" && (
                  <div className="flex items-center gap-1 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">Active</span>
                  </div>
                )}
                {subscription?.planStatus === "past_due" && (
                  <div className="flex items-center gap-1 text-red-600">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">Past Due</span>
                  </div>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">
                  {subscription?.plan === "premium" ? "Next billing date" : "Plan type"}
                </p>
                <p className="font-medium">
                  {subscription?.plan === "premium"
                    ? formatDate(subscription.currentPeriodEnd)
                    : "Free Plan"
                  }
                </p>
              </div>
            </div>

            <Separator />

            <div className="flex gap-3">
              {subscription?.plan === "free" && (
                <Button
                  onClick={handleUpgradeToPremium}
                  disabled={upgrading}
                  className="flex items-center gap-2"
                >
                  {upgrading ? (
                    <BanterLoader />
                  ) : (
                    <Crown className="h-4 w-4" />
                  )}
                  Upgrade to Premium
                </Button>
              )}

              {subscription?.plan === "premium" && subscription?.dodoCustomerId && (
                <Button
                  variant="outline"
                  onClick={handleManageSubscription}
                  disabled={managingSubscription}
                  className="flex items-center gap-2"
                >
                  {managingSubscription ? (
                    <BanterLoader />
                  ) : (
                    <Settings className="h-4 w-4" />
                  )}
                  Manage Subscription
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Usage Overview Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Usage Overview
            </CardTitle>
            <CardDescription>
              Track your feature usage and limits
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {usage && (
              <div className="space-y-4">
                <UsageIndicator feature="interviews" variant="full" />
                <Separator />
                <UsageIndicator feature="resumeTailor" variant="full" />
                <Separator />
                <UsageIndicator feature="autoApply" variant="full" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Plan Comparison Card */}
        <Card>
          <CardHeader>
            <CardTitle>Plans & Features</CardTitle>
            <CardDescription>
              Compare available plans and their features
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Free Plan */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Free Plan</h3>
                  {(!subscription || subscription.plan === "free") && (
                    <Badge variant="secondary">Current</Badge>
                  )}
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Interviews</span>
                    <span className="font-medium">3 per month</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Resume Tailor</span>
                    <span className="font-medium">2 per month</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Auto Apply</span>
                    <span className="font-medium">1 per month</span>
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-2xl font-bold">$0<span className="text-sm text-muted-foreground">/month</span></p>
                </div>
              </div>

              {/* Premium Plan */}
              <div className="border rounded-lg p-4 bg-primary/5 border-primary/20">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Crown className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold">Premium Plan</h3>
                  </div>
                  {subscription?.plan === "premium" ? (
                    <Badge variant="default">Current</Badge>
                  ) : (
                    <Badge variant="default">Recommended</Badge>
                  )}
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Interviews</span>
                    <span className="font-medium text-green-600">Unlimited</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Resume Tailor</span>
                    <span className="font-medium text-green-600">Unlimited</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Auto Apply</span>
                    <span className="font-medium text-green-600">Unlimited</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Priority Support</span>
                    <span className="font-medium text-green-600">✓</span>
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-2xl font-bold">$49<span className="text-sm text-muted-foreground">/month</span></p>
                </div>
                {subscription?.plan === "free" && (
                  <Button
                    className="w-full mt-4"
                    onClick={handleUpgradeToPremium}
                    disabled={upgrading}
                  >
                    {upgrading ? "Processing..." : "Upgrade Now"}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Billing History Card */}
        {subscription?.plan === "premium" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Billing Information
              </CardTitle>
              <CardDescription>
                Manage your billing details and view payment history
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  View detailed billing information and payment history
                </p>
                <Button
                  variant="outline"
                  onClick={handleManageSubscription}
                  disabled={managingSubscription}
                >
                  {managingSubscription ? "Loading..." : "View Billing Details"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
