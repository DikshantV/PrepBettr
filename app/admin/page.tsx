"use client";

import { AdminAnalyticsClient } from './analytics-client';
import FeatureFlagManager from '@/components/admin/FeatureFlagManager';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export default function AdminDashboard() {
  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
      </div>
      
      <Tabs defaultValue="analytics" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="feature-flags">Feature Flags</TabsTrigger>
        </TabsList>
        
        <TabsContent value="analytics" className="space-y-6 mt-6">
          <AdminAnalyticsClient />
        </TabsContent>
        
        <TabsContent value="feature-flags" className="mt-6">
          <FeatureFlagManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
