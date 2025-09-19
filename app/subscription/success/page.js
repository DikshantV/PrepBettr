'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Loader2, ArrowRight, Crown, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const SubscriptionSuccessContent = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [subscriptionData, setSubscriptionData] = useState(null);
  const [error, setError] = useState(null);

  const subscriptionId = searchParams.get('subscription_id');
  const token = searchParams.get('token');

  useEffect(() => {
    const captureSubscription = async () => {
      if (!subscriptionId) {
        setError('No subscription ID found');
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/paypal/capture-subscription', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            subscription_id: subscriptionId,
            token: token,
          }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || 'Failed to process subscription');
        }

        setSubscriptionData(data);
        
        toast.success('Subscription Activated!', {
          description: 'Welcome to PrepBettr! Your subscription is now active.',
          duration: 5000,
        });

      } catch (error) {
        console.error('Error capturing subscription:', error);
        setError(error.message);
        
        toast.error('Subscription Error', {
          description: 'There was an issue activating your subscription. Please contact support.',
        });
      } finally {
        setIsLoading(false);
      }
    };

    captureSubscription();
  }, [subscriptionId, token]);

  const handleContinueToDashboard = () => {
    router.push('/dashboard');
  };

  const handleViewSubscription = () => {
    router.push('/dashboard/subscription');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-100 flex items-center justify-center px-4">
        <Card className="w-full max-w-md bg-gray-900/50 border-gray-700">
          <CardContent className="p-8 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary-200" />
            <h2 className="text-xl font-semibold text-white mb-2">
              Processing Your Subscription
            </h2>
            <p className="text-gray-400">
              Please wait while we activate your subscription...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-dark-100 flex items-center justify-center px-4">
        <Card className="w-full max-w-md bg-gray-900/50 border-gray-700">
          <CardContent className="p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-red-900/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-6 w-6 text-red-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              Subscription Error
            </h2>
            <p className="text-gray-400 mb-6">
              {error}
            </p>
            <div className="space-y-3">
              <Button 
                onClick={() => router.push('/subscription')}
                className="w-full"
                variant="outline"
              >
                Try Again
              </Button>
              <Button 
                onClick={() => router.push('/contact')}
                className="w-full"
                variant="ghost"
              >
                Contact Support
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-100 flex items-center justify-center px-4">
      <Card className="w-full max-w-lg bg-gray-900/50 border-gray-700">
        <CardHeader className="text-center pb-4">
          <div className="w-16 h-16 rounded-full bg-green-900/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-green-400" />
          </div>
          <CardTitle className="text-2xl font-bold text-white mb-2">
            Subscription Activated!
          </CardTitle>
          <CardDescription className="text-gray-400 text-base">
            Welcome to PrepBettr! Your subscription is now active and ready to use.
          </CardDescription>
        </CardHeader>

        <CardContent className="px-6 pb-6">
          {subscriptionData && (
            <div className="space-y-4 mb-6">
              {/* Subscription Details */}
              <div className="bg-gray-800/50 rounded-lg p-4 space-y-3">
                <h3 className="font-semibold text-white flex items-center">
                  <Crown className="w-4 h-4 mr-2 text-primary-200" />
                  Subscription Details
                </h3>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Subscription ID:</span>
                    <span className="text-white font-mono text-xs">
                      {subscriptionData.subscription_id}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-400">Status:</span>
                    <span className="text-green-400 font-medium">
                      {subscriptionData.status}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-400">Plan:</span>
                    <span className="text-white">
                      {subscriptionData.plan_id}
                    </span>
                  </div>
                  
                  {subscriptionData.next_billing_time && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Next Billing:</span>
                      <span className="text-white">
                        {new Date(subscriptionData.next_billing_time).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* What's Next */}
              <div className="bg-primary-200/5 border border-primary-200/20 rounded-lg p-4">
                <h3 className="font-semibold text-white flex items-center mb-3">
                  <Sparkles className="w-4 h-4 mr-2 text-primary-200" />
                  What's Next?
                </h3>
                
                <ul className="space-y-2 text-sm text-gray-300">
                  <li className="flex items-center">
                    <CheckCircle className="w-3 h-3 mr-2 text-green-400 shrink-0" />
                    Access all premium features immediately
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-3 h-3 mr-2 text-green-400 shrink-0" />
                    Start your 7-day free trial
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-3 h-3 mr-2 text-green-400 shrink-0" />
                    Manage your subscription anytime
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button 
              onClick={handleContinueToDashboard}
              className="w-full"
              size="lg"
            >
              <ArrowRight className="w-4 h-4 mr-2" />
              Continue to Dashboard
            </Button>
            
            <Button 
              onClick={handleViewSubscription}
              variant="outline"
              className="w-full"
            >
              Manage Subscription
            </Button>
          </div>

          {/* Support */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              Need help? Contact our{' '}
              <button 
                onClick={() => router.push('/contact')}
                className="text-primary-200 hover:underline"
              >
                support team
              </button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const SubscriptionSuccessPage = () => {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-dark-100 flex items-center justify-center px-4">
        <Card className="w-full max-w-md bg-gray-900/50 border-gray-700">
          <CardContent className="p-8 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary-200" />
            <h2 className="text-xl font-semibold text-white mb-2">
              Loading...
            </h2>
          </CardContent>
        </Card>
      </div>
    }>
      <SubscriptionSuccessContent />
    </Suspense>
  );
};

export default SubscriptionSuccessPage;
