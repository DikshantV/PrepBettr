"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, Clock, XCircle, RefreshCw } from "lucide-react";
import { useRealtimeApplicationStatus } from "@/lib/hooks/useRealtimeFirestore";
import { OptimisticUpdateIndicator } from "@/components/ui/LoadingStates";
import { ApplicationStatus } from "@/types/realtime";
import { toast } from "sonner";

interface ResumeProcessingStatusProps {
  applicationId: string;
  initialStatus?: ApplicationStatus;
  onComplete?: (result: any) => void;
  onError?: (error: string) => void;
}

export default function ResumeProcessingStatus({
  applicationId,
  initialStatus,
  onComplete,
  onError
}: ResumeProcessingStatusProps) {
  const [lastUpdateTime, setLastUpdateTime] = useState<Date>(new Date());
  
  const {
    status,
    loading: isLoading,
    error
  } = useRealtimeApplicationStatus(applicationId);

  // Use real-time data or fallback to initial status
  const currentStatus = status || initialStatus;

  // Handle status changes
  useEffect(() => {
    if (!currentStatus) return;

    setLastUpdateTime(new Date());

    // Handle completion
    if (currentStatus.status === 'completed') {
      toast.success('Processing completed successfully!');
      onComplete?.(currentStatus);
    }

    // Handle errors
    if (currentStatus.status === 'failed') {
      const errorMessage = (currentStatus.details as any)?.errorDetails || (currentStatus as any).message || 'Processing failed';
      toast.error('Processing failed', {
        description: errorMessage
      });
      onError?.(errorMessage);
    }

    // Show warnings
    if (currentStatus.details?.warningMessages?.length) {
      currentStatus.details.warningMessages.forEach(warning => {
        toast.warning('Processing Warning', {
          description: warning
        });
      });
    }
  }, [currentStatus?.status, onComplete, onError]);

  const getStatusIcon = () => {
    switch (currentStatus?.status) {
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'processing':
        return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getStatusColor = () => {
    switch (currentStatus?.status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'processing':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default:
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    }
  };

  const getStatusText = () => {
    switch (currentStatus?.status) {
      case 'processing':
        return 'Processing';
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      default:
        return 'Unknown';
    }
  };

  const getProcessingTypeLabel = () => {
    return 'Processing';
  };

  const formatTimeRemaining = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  const handleRetry = async () => {
    try {
      // This would call an API to retry the processing
      toast.info('Retrying processing...');
      // The real-time listener will pick up the status change
    } catch (error) {
      toast.error('Failed to retry processing');
    }
  };

  const handleCancel = async () => {
    try {
      // This would call an API to cancel the processing
      toast.info('Cancelling processing...');
      // The real-time listener will pick up the status change
    } catch (error) {
      toast.error('Failed to cancel processing');
    }
  };

  if (isLoading && !currentStatus) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-4">
            <div className="w-8 h-8 bg-muted rounded animate-pulse" />
            <div className="space-y-2 flex-1">
              <div className="h-4 w-32 bg-muted rounded animate-pulse" />
              <div className="h-2 w-full bg-muted rounded animate-pulse" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!currentStatus) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">No processing status found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon()}
            <div>
              <CardTitle className="text-lg">{getProcessingTypeLabel()}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={`text-xs ${getStatusColor()}`}>
                  {getStatusText()}
                </Badge>
              </div>
            </div>
          </div>

          {currentStatus.status === 'processing' && (
            <OptimisticUpdateIndicator isPending={true} message="Processing..." />
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress Bar */}
        {currentStatus.status === 'processing' && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {(currentStatus.details as any)?.currentStep || (currentStatus.details as any)?.stage || 'Processing'}
              </span>
              <span className="font-medium">{currentStatus.progress}%</span>
            </div>
            <Progress value={currentStatus.progress} className="h-2" />
            
            <div className="text-xs text-muted-foreground">
              Progress: {currentStatus.progress}%
            </div>
          </div>
        )}

        {/* Current Message */}
        {(currentStatus as any).message && (
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm">{(currentStatus as any).message}</p>
          </div>
        )}


        {/* Error Details */}
        {currentStatus.status === 'failed' && (currentStatus.details as any)?.errorDetails && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-red-800 dark:text-red-200">
                  Processing Failed
                </p>
                <p className="text-xs text-red-600 dark:text-red-300">
                  {(currentStatus.details as any).errorDetails}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {currentStatus.status === 'failed' && (
            <Button size="sm" variant="outline" onClick={handleRetry}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          )}
          
          {currentStatus.status === 'processing' && (
            <Button size="sm" variant="destructive" onClick={handleCancel}>
              Cancel
            </Button>
          )}
          
          {currentStatus.status === 'completed' && (
            <Button size="sm" onClick={() => onComplete?.(currentStatus)}>
              View Result
            </Button>
          )}
        </div>

        {/* Timestamps */}
        <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
          <div>Last updated: {lastUpdateTime.toLocaleString()}</div>
          <div>Updated At: {new Date(currentStatus.updatedAt as any).toLocaleString()}</div>
        </div>
      </CardContent>
    </Card>
  );
}
