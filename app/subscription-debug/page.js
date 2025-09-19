'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const SubscriptionDebugPage = () => {
  const { user, loading } = useAuth();
  const [debugInfo, setDebugInfo] = useState({});
  
  useEffect(() => {
    const info = {
      timestamp: new Date().toISOString(),
      user: user ? { uid: user.uid, email: user.email } : null,
      loading,
      paypalClientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ? 'Present' : 'Missing',
      userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'Server',
      location: typeof window !== 'undefined' ? window.location.href : 'Unknown'
    };
    
    setDebugInfo(info);
    console.log('🔍 Subscription Debug Info:', info);
  }, [user, loading]);
  
  if (loading) {
    return (
      <div className="min-h-screen bg-dark-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-200 mx-auto mb-4"></div>
          <p className="text-gray-400">Checking authentication...</p>
          <p className="text-xs text-gray-500 mt-2">Auth Loading: {loading.toString()}</p>
        </div>
      </div>
    );
  }
  
  if (!user) {
    return (
      <div className="min-h-screen bg-dark-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Authentication Required</h1>
          <p className="text-gray-400 mb-4">Please sign in to access subscription page</p>
          <a href="/auth/login" className="text-primary-200 hover:underline">
            Go to Login
          </a>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-dark-100 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            🔍 Subscription Debug Page
          </h1>
          <p className="text-gray-400">
            This is a simplified version to test if the basic page loads correctly
          </p>
        </div>
        
        <div className="bg-dark-200 rounded-xl p-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-4">Debug Information</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Timestamp:</span>
              <span className="text-white">{debugInfo.timestamp}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">User:</span>
              <span className="text-white">{debugInfo.user?.email || 'Not authenticated'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Auth Loading:</span>
              <span className="text-white">{debugInfo.loading?.toString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">PayPal Client ID:</span>
              <span className="text-white">{debugInfo.paypalClientId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Location:</span>
              <span className="text-white text-xs">{debugInfo.location}</span>
            </div>
          </div>
        </div>
        
        <div className="bg-dark-200 rounded-xl p-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-4">Simple Subscription Plans</h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-dark-300 rounded-lg p-6">
              <h3 className="text-lg font-bold text-white mb-2">Individual Plan</h3>
              <p className="text-gray-400 mb-4">Perfect for job seekers</p>
              <div className="text-3xl font-bold text-primary-200 mb-4">$49/mo</div>
              <button className="w-full bg-primary-200 text-dark-100 py-2 px-4 rounded-lg font-semibold hover:bg-primary-200/90">
                Select Individual
              </button>
            </div>
            
            <div className="bg-dark-300 rounded-lg p-6 border border-primary-200/30">
              <div className="text-center">
                <span className="bg-primary-200 text-dark-100 px-2 py-1 rounded text-xs font-bold">Most Popular</span>
              </div>
              <h3 className="text-lg font-bold text-white mb-2 mt-2">Enterprise Plan</h3>
              <p className="text-gray-400 mb-4">For teams and organizations</p>
              <div className="text-3xl font-bold text-primary-200 mb-4">$199/mo</div>
              <button className="w-full bg-primary-200 text-dark-100 py-2 px-4 rounded-lg font-semibold hover:bg-primary-200/90">
                Select Enterprise
              </button>
            </div>
          </div>
        </div>
        
        <div className="text-center">
          <p className="text-gray-400 mb-4">
            If this page loads correctly, the issue is with PayPal SDK or component complexity
          </p>
          <a 
            href="/subscription" 
            className="text-primary-200 hover:underline"
          >
            ← Back to Full Subscription Page
          </a>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionDebugPage;