"use client";

import { AdminSubscriptionsClient } from './admin-subscriptions-client';

export default function AdminSubscriptionsPage() {
  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Admin - Subscriptions</h1>
      <AdminSubscriptionsClient />
    </div>
  );
}

