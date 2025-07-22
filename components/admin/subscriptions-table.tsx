"use client";
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MoreHorizontal, RefreshCw, Crown, Calendar } from 'lucide-react';
import { PlanType, PlanStatus, UserUsageCounters } from '@/types/subscription';

export interface SubscriptionData {
  userId: string;
  email: string;
  name: string;
  plan: PlanType;
  planStatus: PlanStatus;
  currentPeriodEnd: Date | null;
  dodoCustomerId: string | null;
  dodoSubscriptionId: string | null;
  createdAt: Date | null;
  lastLogin: Date | null;
  usage: UserUsageCounters | null;
}

interface SubscriptionsTableProps {
  subscriptions: SubscriptionData[];
  onRefresh: () => void;
  onUserAction: (userId: string, action: string, data?: any) => Promise<void>;
}

export function SubscriptionsTable({
  subscriptions,
  onRefresh,
  onUserAction
}: SubscriptionsTableProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SubscriptionData | null>(null);
  const [actionType, setActionType] = useState<string>('');
  const [compDays, setCompDays] = useState('30');
  const [newPlan, setNewPlan] = useState<PlanType>('free');
  const [newStatus, setNewStatus] = useState<PlanStatus>('active');

  const getPlanBadgeVariant = (plan: PlanType) => {
    return plan === 'premium' ? 'default' : 'secondary';
  };

  const getStatusBadgeVariant = (status: PlanStatus) => {
    switch (status) {
      case 'active': return 'default';
      case 'canceled': return 'destructive';
      case 'past_due': return 'destructive';
      case 'incomplete': return 'secondary';
      case 'trialing': return 'outline';
      default: return 'secondary';
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return 'N/A';
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  };

  const formatUsage = (usage: UserUsageCounters | null) => {
    if (!usage) return 'No data';
    return `I:${usage.interviews?.count || 0}/${usage.interviews?.limit === -1 ? '∞' : usage.interviews?.limit || 0} | ` +
           `R:${usage.resumeTailor?.count || 0}/${usage.resumeTailor?.limit === -1 ? '∞' : usage.resumeTailor?.limit || 0} | ` +
           `A:${usage.autoApply?.count || 0}/${usage.autoApply?.limit === -1 ? '∞' : usage.autoApply?.limit || 0}`;
  };

  const handleAction = async (action: string, user: SubscriptionData) => {
    setSelectedUser(user);
    setActionType(action);
    setDialogOpen(true);
  };

  const executeAction = async () => {
    if (!selectedUser || !actionType) return;

    setActionLoading(selectedUser.userId);
    try {
      let actionData;
      
      switch (actionType) {
        case 'resetCounters':
          actionData = {};
          break;
        case 'compPremium':
          actionData = { durationDays: parseInt(compDays) };
          break;
        case 'changePlan':
          actionData = { plan: newPlan, status: newStatus };
          break;
      }

      await onUserAction(selectedUser.userId, actionType, actionData);
      setDialogOpen(false);
      onRefresh();
    } catch (error) {
      console.error('Action failed:', error);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Subscriptions</CardTitle>
          <CardDescription>
            Manage user subscriptions and usage counters
          </CardDescription>
        </div>
        <Button onClick={onRefresh} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Period End</TableHead>
              <TableHead>Usage</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subscriptions.map((subscription) => (
              <TableRow key={subscription.userId}>
                <TableCell>
                  <div>
                    <div className="font-medium">{subscription.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {subscription.email}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={getPlanBadgeVariant(subscription.plan)}>
                    {subscription.plan}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={getStatusBadgeVariant(subscription.planStatus)}>
                    {subscription.planStatus}
                  </Badge>
                </TableCell>
                <TableCell>{formatDate(subscription.currentPeriodEnd)}</TableCell>
                <TableCell>
                  <div className="text-xs font-mono">
                    {formatUsage(subscription.usage)}
                  </div>
                </TableCell>
                <TableCell>{formatDate(subscription.lastLogin)}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAction('resetCounters', subscription)}
                      disabled={actionLoading === subscription.userId}
                    >
                      <RefreshCw className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAction('compPremium', subscription)}
                      disabled={actionLoading === subscription.userId}
                    >
                      <Crown className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAction('changePlan', subscription)}
                      disabled={actionLoading === subscription.userId}
                    >
                      <MoreHorizontal className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>
                {actionType === 'resetCounters' && 'Reset Usage Counters'}
                {actionType === 'compPremium' && 'Comp Premium Access'}
                {actionType === 'changePlan' && 'Change Plan'}
              </DialogTitle>
              <DialogDescription>
                {selectedUser && (
                  <>Action for user: {selectedUser.name} ({selectedUser.email})</>
                )}
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              {actionType === 'resetCounters' && (
                <p className="text-sm text-muted-foreground">
                  This will reset all usage counters for this user to 0.
                </p>
              )}
              
              {actionType === 'compPremium' && (
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="comp-days" className="text-right">
                    Days
                  </Label>
                  <Input
                    id="comp-days"
                    type="number"
                    value={compDays}
                    onChange={(e) => setCompDays(e.target.value)}
                    className="col-span-3"
                  />
                </div>
              )}
              
              {actionType === 'changePlan' && (
                <>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="new-plan" className="text-right">
                      Plan
                    </Label>
                    <Select value={newPlan} onValueChange={(value: PlanType) => setNewPlan(value)}>
                      <SelectTrigger className="col-span-3">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">Free</SelectItem>
                        <SelectItem value="premium">Premium</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="new-status" className="text-right">
                      Status
                    </Label>
                    <Select value={newStatus} onValueChange={(value: PlanStatus) => setNewStatus(value)}>
                      <SelectTrigger className="col-span-3">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="canceled">Canceled</SelectItem>
                        <SelectItem value="past_due">Past Due</SelectItem>
                        <SelectItem value="incomplete">Incomplete</SelectItem>
                        <SelectItem value="trialing">Trialing</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>
            
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={executeAction}
                disabled={actionLoading === selectedUser?.userId}
              >
                {actionLoading === selectedUser?.userId ? 'Processing...' : 'Confirm'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
