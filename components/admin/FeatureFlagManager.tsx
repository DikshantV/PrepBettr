'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Settings, 
  Users, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  RefreshCw,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { featureFlagsService } from '@/lib/services/feature-flags';
import { UserTargetingService } from '@/lib/services/user-targeting';
import { errorBudgetMonitor, ErrorBudget } from '@/lib/services/error-budget-monitor';

export default function FeatureFlagManager() {
  const [flags, setFlags] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [errorBudgets, setErrorBudgets] = useState<Record<string, ErrorBudget>>({});
  const [rolloutPercentages, setRolloutPercentages] = useState({
    autoApplyAzure: UserTargetingService.ROLLOUT_CONFIGS.autoApplyAzure.percentage,
    portalIntegration: UserTargetingService.ROLLOUT_CONFIGS.portalIntegration.percentage,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [flagsData, debugData, budgetsData] = await Promise.all([
        featureFlagsService.getAllFeatureFlags(),
        featureFlagsService.getDebugInfo(),
        errorBudgetMonitor.getAllErrorBudgets(),
      ]);

      setFlags(flagsData);
      setDebugInfo(debugData);
      setErrorBudgets(budgetsData);
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateRolloutPercentage = (feature: keyof typeof rolloutPercentages, percentage: number) => {
    if (percentage < 0 || percentage > 100) return;
    
    setRolloutPercentages(prev => ({ ...prev, [feature]: percentage }));
    UserTargetingService.updateRolloutPercentage(feature, percentage);
    loadData(); // Refresh data
  };

  const increaseRollout = (feature: keyof typeof rolloutPercentages, increment: number = 5) => {
    const newPercentage = Math.min(100, rolloutPercentages[feature] + increment);
    updateRolloutPercentage(feature, newPercentage);
  };

  const decreaseRollout = (feature: keyof typeof rolloutPercentages, decrement: number = 5) => {
    const newPercentage = Math.max(0, rolloutPercentages[feature] - decrement);
    updateRolloutPercentage(feature, newPercentage);
  };

  const getBudgetStatus = (budget: ErrorBudget) => {
    if (budget.budgetExceeded) return 'error';
    if (budget.currentErrors > budget.errorThreshold * 0.8) return 'warning';
    return 'ok';
  };

  const getBudgetColor = (status: string) => {
    switch (status) {
      case 'error': return 'text-red-500';
      case 'warning': return 'text-yellow-500';
      default: return 'text-green-500';
    }
  };

  const getBudgetIcon = (status: string) => {
    switch (status) {
      case 'error': return XCircle;
      case 'warning': return AlertTriangle;
      default: return CheckCircle;
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-700 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-48 bg-gray-800 rounded"></div>
            <div className="h-48 bg-gray-800 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">Feature Flag Management</h1>
        <Button onClick={loadData} variant="outline" className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="rollout" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="rollout">Rollout Control</TabsTrigger>
          <TabsTrigger value="monitoring">Error Monitoring</TabsTrigger>
          <TabsTrigger value="debug">Debug Info</TabsTrigger>
        </TabsList>

        {/* Rollout Control */}
        <TabsContent value="rollout" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Auto Apply Azure */}
            <Card className="bg-gray-900 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center justify-between">
                  Auto Apply Azure
                  <Badge variant={flags?.autoApplyAzure ? "default" : "secondary"}>
                    {flags?.autoApplyAzure ? "Active" : "Inactive"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-gray-300">Rollout Percentage</Label>
                    <span className="text-white font-bold">
                      {rolloutPercentages.autoApplyAzure}%
                    </span>
                  </div>
                  <Progress 
                    value={rolloutPercentages.autoApplyAzure} 
                    className="h-2"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => decreaseRollout('autoApplyAzure')}
                    className="flex items-center gap-1"
                  >
                    <TrendingDown className="h-3 w-3" />
                    -5%
                  </Button>
                  <Button
                    size="sm" 
                    variant="outline"
                    onClick={() => increaseRollout('autoApplyAzure')}
                    className="flex items-center gap-1"
                  >
                    <TrendingUp className="h-3 w-3" />
                    +5%
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-300">Custom Percentage</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={rolloutPercentages.autoApplyAzure}
                      onChange={(e) => setRolloutPercentages(prev => ({ 
                        ...prev, 
                        autoApplyAzure: parseInt(e.target.value) || 0 
                      }))}
                      className="bg-gray-800 border-gray-600 text-white"
                    />
                    <Button
                      size="sm"
                      onClick={() => updateRolloutPercentage('autoApplyAzure', rolloutPercentages.autoApplyAzure)}
                    >
                      Apply
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Portal Integration */}
            <Card className="bg-gray-900 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center justify-between">
                  Portal Integration
                  <Badge variant={flags?.portalIntegration ? "default" : "secondary"}>
                    {flags?.portalIntegration ? "Active" : "Inactive"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-gray-300">Rollout Percentage</Label>
                    <span className="text-white font-bold">
                      {rolloutPercentages.portalIntegration}%
                    </span>
                  </div>
                  <Progress 
                    value={rolloutPercentages.portalIntegration} 
                    className="h-2"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => decreaseRollout('portalIntegration')}
                    className="flex items-center gap-1"
                  >
                    <TrendingDown className="h-3 w-3" />
                    -5%
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => increaseRollout('portalIntegration')}
                    className="flex items-center gap-1"
                  >
                    <TrendingUp className="h-3 w-3" />
                    +5%
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-300">Custom Percentage</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={rolloutPercentages.portalIntegration}
                      onChange={(e) => setRolloutPercentages(prev => ({ 
                        ...prev, 
                        portalIntegration: parseInt(e.target.value) || 0 
                      }))}
                      className="bg-gray-800 border-gray-600 text-white"
                    />
                    <Button
                      size="sm"
                      onClick={() => updateRolloutPercentage('portalIntegration', rolloutPercentages.portalIntegration)}
                    >
                      Apply
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Error Monitoring */}
        <TabsContent value="monitoring" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(errorBudgets).map(([featureName, budget]) => {
              const status = getBudgetStatus(budget);
              const StatusIcon = getBudgetIcon(status);
              
              return (
                <Card key={featureName} className="bg-gray-900 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <StatusIcon className={`h-5 w-5 ${getBudgetColor(status)}`} />
                      {featureName}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300">Error Count</span>
                      <span className={`font-bold ${getBudgetColor(status)}`}>
                        {budget.currentErrors} / {budget.errorThreshold}
                      </span>
                    </div>
                    
                    <Progress 
                      value={(budget.currentErrors / budget.errorThreshold) * 100} 
                      className="h-2"
                    />
                    
                    <div className="text-xs text-gray-400">
                      Time Window: {budget.timeWindow} minutes
                    </div>
                    
                    {budget.budgetExceeded && (
                      <Alert className="border-red-600 bg-red-900/20">
                        <AlertTriangle className="h-4 w-4 text-red-400" />
                        <AlertDescription className="text-red-200">
                          Error budget exceeded! Consider reducing rollout.
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Debug Info */}
        <TabsContent value="debug" className="space-y-4">
          {debugInfo && (
            <Card className="bg-gray-900 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Debug Information</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-gray-800 p-4 rounded text-sm text-gray-300 overflow-auto">
                  {JSON.stringify(debugInfo, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
