"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { DollarSign, Users, TrendingDown, Activity } from 'lucide-react';

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

interface AnalyticsChartsProps {
  data: AnalyticsData;
}

export function AnalyticsCharts({ data }: AnalyticsChartsProps) {
  const maxRevenue = Math.max(...data.revenue.byDay.map(d => d.amount), 1);
  const premiumPercentage = (data.subscriptions.byPlan.premium / data.subscriptions.byPlan.total) * 100;
  const freePercentage = (data.subscriptions.byPlan.free / data.subscriptions.byPlan.total) * 100;

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      {/* Summary Cards */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${data.revenue.total.toFixed(2)}</div>
          <p className="text-xs text-muted-foreground">Last {data.period.days} days</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Users</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.subscriptions.byPlan.total}</div>
          <p className="text-xs text-muted-foreground">+{data.userGrowth.total} this period</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Churn Rate</CardTitle>
          <TrendingDown className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.churn.rate.toFixed(1)}%</div>
          <p className="text-xs text-muted-foreground">{data.churn.count} users churned</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">MRR Estimate</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${data.subscriptions.mrr.toFixed(2)}</div>
          <p className="text-xs text-muted-foreground">Monthly recurring</p>
        </CardContent>
      </Card>

      {/* Revenue Chart */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Daily Revenue</CardTitle>
          <CardDescription>Revenue over the last {data.period.days} days</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.revenue.byDay.slice(-7).map((day, index) => (
              <div key={day.date} className="flex items-center space-x-2">
                <div className="text-sm w-20">{new Date(day.date).toLocaleDateString()}</div>
                <div className="flex-1">
                  <Progress 
                    value={(day.amount / maxRevenue) * 100} 
                    className="h-2" 
                  />
                </div>
                <div className="text-sm font-medium w-16">${day.amount.toFixed(2)}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Subscription Breakdown */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Subscription Breakdown</CardTitle>
          <CardDescription>Distribution of users by plan</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Badge variant="secondary">Free</Badge>
                  <span className="text-sm">{data.subscriptions.byPlan.free} users</span>
                </div>
                <span className="text-sm font-medium">{freePercentage.toFixed(1)}%</span>
              </div>
              <Progress value={freePercentage} className="h-2" />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Badge variant="default">Premium</Badge>
                  <span className="text-sm">{data.subscriptions.byPlan.premium} users</span>
                </div>
                <span className="text-sm font-medium">{premiumPercentage.toFixed(1)}%</span>
              </div>
              <Progress value={premiumPercentage} className="h-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Events */}
      <Card className="md:col-span-4">
        <CardHeader>
          <CardTitle>Recent Subscription Events</CardTitle>
          <CardDescription>Latest subscription activity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.recentEvents.slice(0, 10).map((event, index) => (
              <div key={event.id} className="flex items-center justify-between p-2 border rounded">
                <div className="flex items-center space-x-3">
                  <Badge variant="outline" className="text-xs">
                    {event.eventType}
                  </Badge>
                  <span className="text-sm">{event.userId}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(event.timestamp).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
