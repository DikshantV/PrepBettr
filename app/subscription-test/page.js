'use client';

import React from 'react';
import SubscriptionCheckout from '@/components/SubscriptionCheckout';
import { toast } from 'sonner';

const SubscriptionTestPage = () => {
  // Mock user data for testing
  const mockUser = {
    email: 'test@example.com',
    displayName: 'Test User'
  };

  const handleSubscriptionSuccess = async (subscriptionData, planType) => {
    console.log('🎉 Subscription successful:', { subscriptionData, planType });
    
    toast.success('Subscription Activated!', {
      description: `Welcome to ${planType}! Your subscription is now active.`,
      duration: 5000,
    });
  };

  const handleSubscriptionError = (error, planType) => {
    console.error('❌ Subscription error:', { error, planType });
    
    toast.error('Subscription Failed', {
      description: `Failed to activate ${planType} subscription. Please try again.`,
      duration: 8000,
    });
  };

  return (
    <div className="min-h-screen pattern py-12">
      {/* Debug Banner */}
      <div className="max-w-4xl mx-auto px-4 mb-6">
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4">
          <p className="text-blue-300 text-sm text-center">
            🧪 <strong>Test Mode:</strong> Authentication bypassed for PayPal integration testing
            <br />
            <span className="text-xs text-blue-400">
              Mock User: {mockUser.email} | This page tests PayPal SDK loading and timeout handling
            </span>
          </p>
        </div>
      </div>
      
      <SubscriptionCheckout
        userEmail={mockUser.email}
        userName={mockUser.displayName}
        onSubscriptionSuccess={handleSubscriptionSuccess}
        onSubscriptionError={handleSubscriptionError}
      />
    </div>
  );
};

export default SubscriptionTestPage;