"use client";

import { useEffect, useState } from 'react';
import { SubscriptionsTable, SubscriptionData } from '@/components/admin/subscriptions-table';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';

const fetchSubscriptions = async (): Promise<{ subscriptions: SubscriptionData[] }> => {
  const response = await fetch('/api/admin/subscriptions');
  if (!response.ok) throw new Error('Failed to load subscriptions');
  return response.json();
};

const performUserAction = async (userId: string, action: string, data?: any) => {
  const response = await fetch(`/api/admin/users/${userId}/actions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, data })
  });
  if (!response.ok) throw new Error('Action failed');
  return response.json();
};

export function AdminSubscriptionsClient() {
  const [subscriptions, setSubscriptions] = useState<SubscriptionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSubscriptions();
      setSubscriptions(data.subscriptions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Error loading subscriptions: {error}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <SubscriptionsTable 
      subscriptions={subscriptions} 
      onRefresh={loadData} 
      onUserAction={performUserAction} 
    />
  );
}
