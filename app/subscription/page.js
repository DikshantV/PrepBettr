'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import SubscriptionCheckout from '@/components/SubscriptionCheckout';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const SubscriptionPage = () => {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');

  useEffect(() => {
    if (!loading) {
      if (user) {
        setUserEmail(user.email || '');
        setUserName(user.displayName || '');
      } else {
        // Redirect to login if not authenticated
        router.push('/auth/login?redirect=/subscription');
      }
    }
  }, [user, loading, router]);

  const handleSubscriptionSuccess = async (subscriptionData, planType) => {
    console.log('Subscription successful:', { subscriptionData, planType });
    
    // Show success message
    toast.success('Subscription Activated!', {
      description: `Welcome to ${planType}! Your subscription is now active.`,
      duration: 5000,
    });

    // TODO: Update user's subscription status in your database
    // You might want to call an API endpoint to update the user's subscription
    /*
    try {
      await fetch('/api/user/update-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          subscriptionId: subscriptionData.subscriptionId,
          planType,
          provider: 'paypal'
        })
      });
    } catch (error) {
      console.error('Failed to update user subscription:', error);
    }
    */

    // Redirect to success page or dashboard
    setTimeout(() => {
      router.push('/dashboard?subscription=success');
    }, 2000);
  };

  const handleSubscriptionError = (error, planType) => {
    console.error('Subscription error:', { error, planType });
    
    toast.error('Subscription Failed', {
      description: `Failed to activate ${planType} subscription. Please try again.`,
      duration: 8000,
    });
  };

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen pattern flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-200 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading subscription plans...</p>
        </div>
      </div>
    );
  }

  // Don't render if user is not authenticated (will redirect)
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen pattern py-12">
      <SubscriptionCheckout
        userEmail={userEmail}
        userName={userName}
        onSubscriptionSuccess={handleSubscriptionSuccess}
        onSubscriptionError={handleSubscriptionError}
      />
    </div>
  );
};

export default SubscriptionPage;
