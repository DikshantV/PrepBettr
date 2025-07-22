"use client";

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminAnalyticsClient } from './analytics-client';
import { AdminSubscriptionsClient } from './subscriptions/admin-subscriptions-client';

export default function AdminDashboard() {
  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
      </div>
      
      <Tabs defaultValue="analytics" className="space-y-6">
        <TabsList>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
        </TabsList>
        
        <TabsContent value="analytics">
          <AdminAnalyticsClient />
        </TabsContent>
        
        <TabsContent value="subscriptions">
          <AdminSubscriptionsClient />
        </TabsContent>
      </Tabs>
    </div>
  );
}
