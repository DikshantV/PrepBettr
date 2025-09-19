'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { XCircle, ArrowLeft, RefreshCw } from 'lucide-react';

const SubscriptionCancelPage = () => {
  const router = useRouter();

  const handleBackToPlans = () => {
    router.push('/subscription');
  };

  const handleTryAgain = () => {
    router.push('/subscription');
  };

  const handleContactSupport = () => {
    router.push('/contact');
  };

  return (
    <div className="min-h-screen bg-dark-100 flex items-center justify-center px-4">
      <Card className="w-full max-w-md bg-gray-900/50 border-gray-700">
        <CardHeader className="text-center pb-4">
          <div className="w-16 h-16 rounded-full bg-orange-900/20 flex items-center justify-center mx-auto mb-4">
            <XCircle className="h-8 w-8 text-orange-400" />
          </div>
          <CardTitle className="text-2xl font-bold text-white mb-2">
            Subscription Cancelled
          </CardTitle>
          <CardDescription className="text-gray-400 text-base">
            You cancelled the subscription process. No payment was processed.
          </CardDescription>
        </CardHeader>

        <CardContent className="px-6 pb-6">
          {/* Info Section */}
          <div className="bg-gray-800/50 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-white mb-3">
              What happened?
            </h3>
            <ul className="space-y-2 text-sm text-gray-300">
              <li className="flex items-start">
                <XCircle className="w-3 h-3 mr-2 text-orange-400 shrink-0 mt-0.5" />
                The PayPal subscription process was cancelled
              </li>
              <li className="flex items-start">
                <XCircle className="w-3 h-3 mr-2 text-orange-400 shrink-0 mt-0.5" />
                No charges were made to your account
              </li>
              <li className="flex items-start">
                <XCircle className="w-3 h-3 mr-2 text-orange-400 shrink-0 mt-0.5" />
                You can try again anytime
              </li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button 
              onClick={handleTryAgain}
              className="w-full"
              size="lg"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
            
            <Button 
              onClick={handleBackToPlans}
              variant="outline"
              className="w-full"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Plans
            </Button>

            <Button 
              onClick={handleContactSupport}
              variant="ghost"
              className="w-full text-gray-400 hover:text-white"
            >
              Need Help? Contact Support
            </Button>
          </div>

          {/* Additional Info */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              Still interested in PrepBettr? Check out our{' '}
              <button 
                onClick={() => router.push('/features')}
                className="text-primary-200 hover:underline"
              >
                features
              </button>
              {' '}or{' '}
              <button 
                onClick={() => router.push('/demo')}
                className="text-primary-200 hover:underline"
              >
                try our demo
              </button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SubscriptionCancelPage;
