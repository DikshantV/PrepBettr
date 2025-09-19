'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Code, 
  PlayCircle, 
  Settings, 
  TestTube, 
  Database,
  Globe,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Monitor,
  Smartphone,
  Tablet
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Import our subscription components
import PlanSelector from '@/components/subscription/PlanSelector';
import SubscriptionButton from '@/components/subscription/SubscriptionButton';
import PricingToggle from '@/components/subscription/PricingToggle';
import SubscriptionStatus from '@/components/subscription/SubscriptionStatus';
import { PREPBETTR_PLANS, pricingUtils } from '@/lib/pricing-config';

/**
 * Test Subscription Page - Development testing tool for subscription components
 * Access via /test-subscription (development only)
 * 
 * Features:
 * - Component testing and preview
 * - PayPal integration testing
 * - Sandbox environment switching
 * - Mock data scenarios
 * - Responsive testing
 */
const TestSubscriptionPage = () => {
  // Environment and configuration state
  const [environment, setEnvironment] = useState('sandbox');
  const [isYearly, setIsYearly] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('individual');
  const [testScenario, setTestScenario] = useState('default');
  const [viewportSize, setViewportSize] = useState('desktop');
  
  // Component states for testing
  const [componentTests, setComponentTests] = useState({
    planSelector: { status: 'idle', error: null },
    subscriptionButton: { status: 'idle', error: null },
    pricingToggle: { status: 'idle', error: null },
    subscriptionStatus: { status: 'idle', error: null }
  });

  // Mock data for testing
  const mockUser = {
    id: 'test-user-123',
    email: 'test@prepbettr.com',
    name: 'Test User'
  };

  const mockSubscription = {
    id: 'sub_test_123456789',
    userId: 'test-user-123',
    planId: selectedPlan,
    status: testScenario === 'cancelled' ? 'cancelled' : 'active',
    billingCycle: isYearly ? 'yearly' : 'monthly',
    price: isYearly ? 
      (selectedPlan === 'enterprise' ? 165.83 : 40.83) :
      (selectedPlan === 'enterprise' ? 199 : 49),
    createdAt: '2024-01-15T10:00:00Z',
    currentPeriodEnd: '2024-02-15T10:00:00Z',
    paypalSubscriptionId: 'I-PAYPAL123456789'
  };

  const mockUsage = {
    resumes: testScenario === 'heavy' ? 8 : 3,
    interviews: testScenario === 'heavy' ? 18 : 7,
    coverLetters: testScenario === 'heavy' ? 4 : 2
  };

  // Test scenarios
  const testScenarios = {
    default: { label: 'Default User', description: 'Normal usage patterns' },
    heavy: { label: 'Heavy User', description: 'Near usage limits' },
    cancelled: { label: 'Cancelled Subscription', description: 'Cancelled subscription state' },
    trial: { label: 'Trial User', description: 'Free trial period' },
    expired: { label: 'Expired Subscription', description: 'Expired subscription' }
  };

  // Viewport sizes for responsive testing
  const viewportSizes = {
    mobile: { label: 'Mobile', width: '375px', icon: <Smartphone className="w-4 h-4" /> },
    tablet: { label: 'Tablet', width: '768px', icon: <Tablet className="w-4 h-4" /> },
    desktop: { label: 'Desktop', width: '100%', icon: <Monitor className="w-4 h-4" /> }
  };

  // Environment configuration
  useEffect(() => {
    // Log environment configuration
    console.log('Test Environment Configuration:', {
      environment,
      paypalMode: process.env.PAYPAL_MODE,
      paypalClientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID,
      nodeEnv: process.env.NODE_ENV
    });
  }, [environment]);

  // Test component functionality
  const testComponent = async (componentName, testFunction) => {
    setComponentTests(prev => ({
      ...prev,
      [componentName]: { status: 'testing', error: null }
    }));

    try {
      await testFunction();
      setComponentTests(prev => ({
        ...prev,
        [componentName]: { status: 'success', error: null }
      }));
    } catch (error) {
      console.error(`${componentName} test failed:`, error);
      setComponentTests(prev => ({
        ...prev,
        [componentName]: { status: 'error', error: error.message }
      }));
    }
  };

  // Component test functions
  const testPlanSelector = async () => {
    // Simulate plan selection testing
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('PlanSelector test completed');
  };

  const testSubscriptionButton = async () => {
    // Test subscription button functionality
    await new Promise(resolve => setTimeout(resolve, 1500));
    console.log('SubscriptionButton test completed');
  };

  const testPricingToggle = async () => {
    // Test pricing toggle functionality
    await new Promise(resolve => setTimeout(resolve, 800));
    console.log('PricingToggle test completed');
  };

  const testSubscriptionStatus = async () => {
    // Test subscription status display
    await new Promise(resolve => setTimeout(resolve, 1200));
    console.log('SubscriptionStatus test completed');
  };

  // Handle subscription success (for testing)
  const handleSubscriptionSuccess = (subscriptionData, planType) => {
    console.log('Test Subscription Success:', { subscriptionData, planType });
    alert(`Test subscription created successfully!\nPlan: ${planType}\nData: ${JSON.stringify(subscriptionData, null, 2)}`);
  };

  // Handle subscription error (for testing)
  const handleSubscriptionError = (error, planType) => {
    console.error('Test Subscription Error:', { error, planType });
    alert(`Test subscription failed!\nPlan: ${planType}\nError: ${error.message || error}`);
  };

  // Get test result icon
  const getTestResultIcon = (status) => {
    switch (status) {
      case 'testing':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  // Render environment banner
  const EnvironmentBanner = () => (
    <div className={cn(
      'border-l-4 p-4 mb-6',
      environment === 'production' 
        ? 'bg-red-900/20 border-red-500 text-red-300'
        : 'bg-yellow-900/20 border-yellow-500 text-yellow-300'
    )}>
      <div className="flex items-center space-x-2 mb-2">
        <Globe className="w-5 h-5" />
        <span className="font-semibold">
          {environment === 'production' ? 'PRODUCTION' : 'SANDBOX'} Environment
        </span>
      </div>
      <p className="text-sm">
        {environment === 'production' 
          ? '⚠️ You are testing with LIVE PayPal payments! Use with caution.'
          : '✅ Safe testing environment. No real payments will be processed.'
        }
      </p>
    </div>
  );

  // Only show in development
  if (process.env.NODE_ENV === 'production') {
    return (
      <div className="min-h-screen bg-dark-100 flex items-center justify-center p-4">
        <Card className="bg-gray-900/50 border-gray-700 max-w-md">
          <CardContent className="p-8 text-center">
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">
              Access Denied
            </h2>
            <p className="text-gray-400">
              This testing page is only available in development mode.
            </p>
            <Button 
              className="mt-4"
              onClick={() => window.location.href = '/subscription'}
            >
              Go to Subscription Page
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-100 p-4">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-white flex items-center justify-center">
            <TestTube className="w-8 h-8 mr-3 text-primary-200" />
            Subscription Testing Lab
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Development environment for testing PrepBettr subscription components, 
            PayPal integration, and user flows.
          </p>
        </div>

        <EnvironmentBanner />

        {/* Controls */}
        <Card className="bg-gray-900/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Settings className="w-5 h-5 mr-2" />
              Test Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Environment Toggle */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-300">
                  Environment
                </label>
                <div className="flex items-center space-x-3">
                  <span className="text-sm text-gray-400">Sandbox</span>
                  <Switch
                    checked={environment === 'production'}
                    onCheckedChange={(checked) => 
                      setEnvironment(checked ? 'production' : 'sandbox')
                    }
                  />
                  <span className="text-sm text-gray-400">Production</span>
                </div>
              </div>

              {/* Billing Toggle */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-300">
                  Billing Cycle
                </label>
                <div className="flex items-center space-x-3">
                  <span className="text-sm text-gray-400">Monthly</span>
                  <Switch
                    checked={isYearly}
                    onCheckedChange={setIsYearly}
                  />
                  <span className="text-sm text-gray-400">Yearly</span>
                </div>
              </div>

              {/* Test Scenario */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-300">
                  Test Scenario
                </label>
                <select
                  value={testScenario}
                  onChange={(e) => setTestScenario(e.target.value)}
                  className="w-full p-2 bg-gray-800 border border-gray-700 rounded-md text-white"
                >
                  {Object.entries(testScenarios).map(([key, scenario]) => (
                    <option key={key} value={key}>
                      {scenario.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Viewport Size */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-300">
                  Viewport
                </label>
                <div className="flex space-x-2">
                  {Object.entries(viewportSizes).map(([key, size]) => (
                    <Button
                      key={key}
                      size="sm"
                      variant={viewportSize === key ? 'default' : 'outline'}
                      onClick={() => setViewportSize(key)}
                    >
                      {size.icon}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Component Tests */}
        <Card className="bg-gray-900/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <PlayCircle className="w-5 h-5 mr-2" />
              Component Tests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(componentTests).map(([componentName, test]) => (
                <div key={componentName} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white capitalize">
                      {componentName.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                    {getTestResultIcon(test.status)}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      switch (componentName) {
                        case 'planSelector':
                          testComponent(componentName, testPlanSelector);
                          break;
                        case 'subscriptionButton':
                          testComponent(componentName, testSubscriptionButton);
                          break;
                        case 'pricingToggle':
                          testComponent(componentName, testPricingToggle);
                          break;
                        case 'subscriptionStatus':
                          testComponent(componentName, testSubscriptionStatus);
                          break;
                      }
                    }}
                    disabled={test.status === 'testing'}
                  >
                    {test.status === 'testing' ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <PlayCircle className="w-3 h-3 mr-2" />
                        Test
                      </>
                    )}
                  </Button>
                  {test.error && (
                    <p className="text-xs text-red-400 mt-1">{test.error}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Test Preview Area */}
        <div 
          className="mx-auto transition-all duration-300"
          style={{ maxWidth: viewportSizes[viewportSize].width }}
        >
          {/* Pricing Toggle Test */}
          <Card className="bg-gray-900/50 border-gray-700 mb-6">
            <CardHeader>
              <CardTitle className="text-white">PricingToggle Component</CardTitle>
              <CardDescription>
                Test monthly/yearly billing toggle with different variants
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-3">Default</h4>
                  <PricingToggle
                    isYearly={isYearly}
                    onToggle={setIsYearly}
                    savingsAmount={pricingUtils.getFormattedYearlySavings('individual')}
                    variant="default"
                    size="sm"
                  />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-3">Compact</h4>
                  <PricingToggle
                    isYearly={isYearly}
                    onToggle={setIsYearly}
                    savingsAmount={pricingUtils.getFormattedYearlySavings('individual')}
                    variant="compact"
                    size="md"
                  />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-3">Detailed</h4>
                  <PricingToggle
                    isYearly={isYearly}
                    onToggle={setIsYearly}
                    savingsAmount={pricingUtils.getFormattedYearlySavings('individual')}
                    variant="detailed"
                    size="sm"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Plan Selector Test */}
          <Card className="bg-gray-900/50 border-gray-700 mb-6">
            <CardHeader>
              <CardTitle className="text-white">PlanSelector Component</CardTitle>
              <CardDescription>
                Test plan selection with different layouts and configurations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PlanSelector
                plans={Object.values(PREPBETTR_PLANS)}
                selectedPlan={selectedPlan}
                onPlanSelect={setSelectedPlan}
                isYearly={isYearly}
                showComparison={false}
                interactive={true}
                size="md"
                layout="grid"
                highlightPopular={true}
                showTrialInfo={true}
                showSavingsBadge={true}
              />
            </CardContent>
          </Card>

          {/* Subscription Button Test */}
          <Card className="bg-gray-900/50 border-gray-700 mb-6">
            <CardHeader>
              <CardTitle className="text-white">SubscriptionButton Component</CardTitle>
              <CardDescription>
                Test subscription payment buttons with PayPal integration
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-w-md mx-auto">
                <SubscriptionButton
                  planId={`${selectedPlan}-${isYearly ? 'yearly' : 'monthly'}`}
                  planType={selectedPlan}
                  planName={`${PREPBETTR_PLANS[selectedPlan].name} ${isYearly ? 'Yearly' : 'Monthly'}`}
                  billingCycle={isYearly ? 'yearly' : 'monthly'}
                  price={isYearly ? 
                    PREPBETTR_PLANS[selectedPlan].pricing.yearly.monthlyEquivalent :
                    PREPBETTR_PLANS[selectedPlan].pricing.monthly.amount
                  }
                  userEmail={mockUser.email}
                  userName={mockUser.name}
                  onSuccess={handleSubscriptionSuccess}
                  onError={handleSubscriptionError}
                  showTrialInfo={true}
                  showSavings={isYearly}
                  showSecurityBadge={true}
                  buttonType="paypal"
                />
              </div>
            </CardContent>
          </Card>

          {/* Subscription Status Test */}
          <Card className="bg-gray-900/50 border-gray-700 mb-6">
            <CardHeader>
              <CardTitle className="text-white">SubscriptionStatus Component</CardTitle>
              <CardDescription>
                Test subscription status display with different variants
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-3">Full Variant</h4>
                  <SubscriptionStatus
                    subscription={mockSubscription}
                    userUsage={mockUsage}
                    variant="full"
                    showActions={false}
                    showUsage={true}
                    showBilling={true}
                  />
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-3">Compact Variant</h4>
                  <SubscriptionStatus
                    subscription={mockSubscription}
                    userUsage={mockUsage}
                    variant="compact"
                    showActions={true}
                    showUsage={false}
                    showBilling={true}
                  />
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-3">Minimal Variant</h4>
                  <SubscriptionStatus
                    subscription={mockSubscription}
                    userUsage={mockUsage}
                    variant="minimal"
                    showActions={false}
                    showUsage={false}
                    showBilling={false}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Debug Information */}
        <Card className="bg-gray-900/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Code className="w-5 h-5 mr-2" />
              Debug Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium text-gray-300 mb-3">Environment</h4>
                <pre className="bg-gray-800 p-3 rounded text-xs text-gray-300 overflow-auto">
                  {JSON.stringify({
                    NODE_ENV: process.env.NODE_ENV,
                    PAYPAL_MODE: environment,
                    NEXT_PUBLIC_PAYPAL_CLIENT_ID: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID?.substring(0, 10) + '...',
                  }, null, 2)}
                </pre>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-300 mb-3">Test State</h4>
                <pre className="bg-gray-800 p-3 rounded text-xs text-gray-300 overflow-auto">
                  {JSON.stringify({
                    selectedPlan,
                    isYearly,
                    testScenario,
                    viewportSize
                  }, null, 2)}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TestSubscriptionPage;