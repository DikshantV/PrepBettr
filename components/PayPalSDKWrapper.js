'use client';

import React, { useState, useEffect } from 'react';
import { PayPalScriptProvider } from '@paypal/react-paypal-js';
import { AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const PayPalSDKWrapper = ({ children, onSDKReady, onSDKError }) => {
  const [sdkStatus, setSdkStatus] = useState('loading'); // loading, ready, error, timeout
  const [error, setError] = useState(null);
  const [loadingTime, setLoadingTime] = useState(0);
  
  const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  
  // Check if PayPal client ID is available
  if (!paypalClientId) {
    return (
      <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-xl p-6 text-center">
        <AlertCircle className="h-8 w-8 text-yellow-400 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-yellow-400 mb-2">Payment Configuration Issue</h3>
        <p className="text-gray-300 mb-4">
          Payment services are currently being configured. Please try again in a few minutes.
        </p>
        <Button 
          variant="outline" 
          onClick={() => window.location.reload()}
          className="bg-yellow-900/30 border-yellow-500/50 text-yellow-300 hover:bg-yellow-900/50"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh Page
        </Button>
      </div>
    );
  }
  
  // PayPal SDK loading timeout management
  useEffect(() => {
    const startTime = Date.now();
    
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setLoadingTime(elapsed);
      
      // Force timeout after 20 seconds
      if (elapsed >= 20 && sdkStatus === 'loading') {
        setSdkStatus('timeout');
        clearInterval(timer);
        
        const timeoutError = new Error('PayPal SDK loading timeout after 20 seconds');
        setError(timeoutError);
        onSDKError?.(timeoutError);
        
        toast.error('Payment Service Timeout', {
          description: 'PayPal services are taking too long to load. Please check your connection.',
          duration: 10000
        });
      }
    }, 1000);
    
    return () => clearInterval(timer);
  }, [sdkStatus, onSDKError]);
  
  const handleSDKReady = () => {
    console.log('✅ PayPal SDK loaded successfully in', loadingTime, 'seconds');
    setSdkStatus('ready');
    onSDKReady?.();
  };
  
  const handleSDKError = (error) => {
    console.error('❌ PayPal SDK error:', error);
    setSdkStatus('error');
    setError(error);
    onSDKError?.(error);
    
    toast.error('Payment Service Error', {
      description: 'Unable to load payment services. Please refresh the page.',
      duration: 8000
    });
  };
  
  const retry = () => {
    setSdkStatus('loading');
    setError(null);
    setLoadingTime(0);
    window.location.reload();
  };
  
  // Show loading state
  if (sdkStatus === 'loading') {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin mr-4 text-primary-200" />
        <div className="text-center">
          <p className="text-white font-medium">Loading PayPal Payment Services...</p>
          <p className="text-gray-400 text-sm mt-1">
            Please wait while we connect to payment services
          </p>
          {loadingTime > 5 && (
            <p className="text-gray-500 text-xs mt-2">
              Loading time: {loadingTime}s
            </p>
          )}
          {loadingTime > 15 && (
            <p className="text-yellow-400 text-xs mt-1">
              This is taking longer than usual...
            </p>
          )}
        </div>
      </div>
    );
  }
  
  // Show timeout state
  if (sdkStatus === 'timeout') {
    return (
      <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-xl p-8 text-center">
        <AlertCircle className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-yellow-400 mb-2">Payment Service Timeout</h2>
        <p className="text-gray-300 mb-2">
          PayPal services are taking longer than expected to load.
        </p>
        <p className="text-sm text-yellow-200 mb-6">
          This may be due to network issues or PayPal service availability.
        </p>
        <div className="flex justify-center space-x-4">
          <Button 
            variant="outline" 
            onClick={retry}
            className="bg-yellow-900/30 border-yellow-500/50 text-yellow-300 hover:bg-yellow-900/50"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry Payment Services
          </Button>
          <Button 
            variant="ghost" 
            onClick={() => setSdkStatus('loading')}
            className="text-yellow-300 hover:bg-yellow-900/30"
          >
            Continue Waiting
          </Button>
        </div>
        <p className="text-xs text-gray-500 mt-4">
          If this problem persists, please contact support.
        </p>
      </div>
    );
  }
  
  // Show error state
  if (sdkStatus === 'error') {
    return (
      <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-8 text-center">
        <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-red-400 mb-2">Payment Service Error</h2>
        <p className="text-gray-300 mb-2">
          Unable to load PayPal payment services.
        </p>
        {error && (
          <p className="text-sm text-red-300 mb-6 font-mono bg-red-900/20 p-2 rounded">
            {error.message}
          </p>
        )}
        <Button 
          variant="outline" 
          onClick={retry}
          className="bg-red-900/30 border-red-500/50 text-red-300 hover:bg-red-900/50"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry Payment Services
        </Button>
        <p className="text-xs text-gray-500 mt-4">
          Please check your internet connection and try again.
        </p>
      </div>
    );
  }
  
  // Render PayPal SDK Provider when ready
  return (
    <PayPalScriptProvider
      options={{
        "client-id": paypalClientId,
        vault: true,
        intent: "subscription",
        currency: "USD",
        components: "buttons"
      }}
      onLoadStart={() => {
        console.log('🔄 PayPal SDK loading started...');
      }}
      onLoadSuccess={() => {
        handleSDKReady();
      }}
      onLoadError={(error) => {
        handleSDKError(error);
      }}
    >
      {children}
    </PayPalScriptProvider>
  );
};

export default PayPalSDKWrapper;