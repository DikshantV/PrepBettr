"use client";

import { useEffect, useState } from 'react';
import { AnalyticsCharts } from '@/components/admin/analytics-charts';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AnalyticsData {
  revenue: {
    total: number;
    byDay: { date: string; amount: number }[];
  };
  subscriptions: {
    byPlan: { free: number; premium: number; total: number };
    byStatus: Record<string, number>;
    mrr: number;
  };
  churn: {
    rate: number;
    count: number;
    period: number;
  };
  userGrowth: {
    total: number;
    byDay: { date: string; count: number }[];
  };
  recentEvents: any[];
  period: { days: number; start: string; end: string };
}

const fetchAnalytics = async (period: string = '30'): Promise<AnalyticsData> => {
  const response = await fetch(`/api/admin/analytics?period=${period}`);
  if (!response.ok) throw new Error('Failed to load analytics');
  return response.json();
};

export function AdminAnalyticsClient() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState('30');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const analyticsData = await fetchAnalytics(period);
      setData(analyticsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [period]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-end">
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Error loading analytics: {error}
        </AlertDescription>
      </Alert>
    );
  }

  if (!data) {
    return <div>No data available</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 days</SelectItem>
            <SelectItem value="30">30 days</SelectItem>
            <SelectItem value="90">90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <AnalyticsCharts data={data} />
    </div>
  );
}
