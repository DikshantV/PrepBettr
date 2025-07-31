"use client";

import { AdminAnalyticsClient } from './analytics-client';

export default function AdminDashboard() {
  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
      </div>
      
      <div className="space-y-6">
        <AdminAnalyticsClient />
      </div>
    </div>
  );
}
