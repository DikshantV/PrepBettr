'use client';

import React, { useState } from 'react';
import { PayPalButtons } from '@paypal/react-paypal-js';
import { Button } from '@/components/ui/button';
import { Loader2, CreditCard, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const PayPalSubscriptionButton = ({
  planId,
  planType,
  planName,
  price,
  billingCycle,
  userEmail,
  userName,
  onSuccess,
  onError,
  className = "",
  variant = "default",
  size = "lg",
  disabled = false
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [error, setError] = useState(null);

  const createSubscription = async (data, actions) => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('Creating subscription with plan ID:', planId);

      // Call our API to create the subscription
      const response = await fetch('/api/paypal/create-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan_id: planId,
          user_email: userEmail,
          user_name: userName,
          return_url: `${window.location.origin}/subscription/success`,
          cancel_url: `${window.location.origin}/subscription/cancel`,
        }),
      });

      const subscriptionData = await response.json();

      if (!response.ok) {
        throw new Error(subscriptionData.message || 'Failed to create subscription');
      }

      if (!subscriptionData.success) {
        throw new Error(subscriptionData.message || 'Subscription creation failed');
      }

      console.log('Subscription created:', subscriptionData.data);

      // Return the subscription ID for PayPal
      return subscriptionData.data.subscription_id;

    } catch (error) {
      console.error('Error creating subscription:', error);
      setError(error.message);
      
      toast.error('Subscription Creation Failed', {
        description: error.message || 'Failed to create subscription. Please try again.',
      });

      if (onError) {
        onError(error);
      }

      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const onApprove = async (data, actions) => {
    setIsLoading(true);
    
    try {
      console.log('Subscription approved:', data);

      // Call our API to capture/verify the subscription
      const response = await fetch('/api/paypal/capture-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscription_id: data.subscriptionID,
          token: data.facilitatorAccessToken,
        }),
      });

      const captureData = await response.json();

      if (!response.ok || !captureData.success) {
        throw new Error(captureData.message || 'Failed to activate subscription');
      }

      setSubscriptionStatus('success');

      toast.success('Subscription Activated!', {
        description: `Welcome to ${planName}! Your subscription is now active.`,
        duration: 5000,
      });

      if (onSuccess) {
        onSuccess({
          subscriptionId: data.subscriptionID,
          planType,
          planName,
          captureData
        });
      }

    } catch (error) {
      console.error('Error approving subscription:', error);
      setError(error.message);
      setSubscriptionStatus('error');

      toast.error('Subscription Activation Failed', {
        description: error.message || 'Failed to activate subscription. Please contact support.',
      });

      if (onError) {
        onError(error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const onCancel = (data) => {
    console.log('Subscription cancelled:', data);
    setSubscriptionStatus('cancelled');

    toast.info('Subscription Cancelled', {
      description: 'You cancelled the subscription process. You can try again anytime.',
    });
  };

  const onErrorHandler = (error) => {
    console.error('PayPal subscription error:', error);
    setError(error.message || 'PayPal error occurred');
    setSubscriptionStatus('error');

    toast.error('Payment Error', {
      description: 'There was an error with PayPal. Please try again or contact support.',
    });

    if (onError) {
      onError(error);
    }
  };

  // Show success state if subscription was successful
  if (subscriptionStatus === 'success') {
    return (
      <Button 
        className={cn("w-full", className)}
        variant="default"
        size={size}
        disabled={true}
      >
        <CheckCircle className="w-4 h-4 mr-2" />
        Subscription Active
      </Button>
    );
  }

  // Show error state
  if (subscriptionStatus === 'error' && error) {
    return (
      <div className="w-full">
        <Button 
          className={cn("w-full mb-2", className)}
          variant="destructive"
          size={size}
          disabled={true}
        >
          <AlertCircle className="w-4 h-4 mr-2" />
          Subscription Failed
        </Button>
        <p className="text-xs text-red-400 text-center">
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      {/* Custom styled PayPal button */}
      <div className="paypal-button-container">
        <PayPalButtons
          disabled={disabled || isLoading}
          forceReRender={[planId, userEmail]}
          createSubscription={createSubscription}
          onApprove={onApprove}
          onCancel={onCancel}
          onError={onErrorHandler}
          style={{
            layout: 'vertical',
            color: 'blue',
            shape: 'rect',
            label: 'subscribe',
            height: size === 'lg' ? 55 : size === 'sm' ? 35 : 45,
            tagline: false,
          }}
          className="paypal-subscription-button"
        />
      </div>

      {/* Loading overlay */}
      {isLoading && (
        <div className="mt-2 flex items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          <span className="text-sm text-gray-400">
            {subscriptionStatus === 'approved' ? 'Activating subscription...' : 'Processing...'}
          </span>
        </div>
      )}

      {/* Plan info */}
      <div className="mt-3 text-center">
        <p className="text-xs text-gray-500">
          {planName} • ${price}/month {billingCycle === 'yearly' ? '(billed annually)' : ''}
        </p>
        {billingCycle === 'yearly' && (
          <p className="text-xs text-green-400 mt-1">
            Includes 7-day free trial
          </p>
        )}
      </div>

      {/* Custom PayPal button styling */}
      <style jsx>{`
        .paypal-button-container {
          width: 100%;
        }
        
        .paypal-subscription-button {
          width: 100% !important;
        }

        /* Override PayPal's default styles to match our theme */
        :global(.paypal-buttons) {
          width: 100%;
          min-height: ${size === 'lg' ? '55px' : size === 'sm' ? '35px' : '45px'};
        }

        :global(.paypal-button) {
          border-radius: 0.375rem !important;
          font-weight: 500 !important;
        }

        /* Custom hover effects */
        :global(.paypal-button:hover) {
          transform: translateY(-1px);
          transition: transform 0.2s ease;
        }

        /* Loading state styles */
        :global(.paypal-button[disabled]) {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};

export default PayPalSubscriptionButton;
