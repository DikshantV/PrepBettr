"use client";

import { useState, useEffect } from 'react';
import { toast } from 'sonner';

interface OfflineQueueItem {
  id: string;
  action: string;
  data: any;
  timestamp: Date;
  retries: number;
  maxRetries: number;
}

interface ConnectionStatus {
  isOnline: boolean;
  isConnected: boolean;
  lastOnlineTime?: Date;
  reconnectAttempts: number;
}

export function useOfflineSupport() {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isConnected: true,
    reconnectAttempts: 0
  });
  
  const [offlineQueue, setOfflineQueue] = useState<OfflineQueueItem[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);

  // Monitor online/offline status
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setConnectionStatus(prev => ({
        ...prev,
        isOnline: true,
        isConnected: true,
        lastOnlineTime: new Date(),
        reconnectAttempts: 0
      }));
      
      toast.success('Connection restored', {
        description: 'Syncing pending changes...'
      });
      
      // Process offline queue when back online
      processOfflineQueue();
    };

    const handleOffline = () => {
      setConnectionStatus(prev => ({
        ...prev,
        isOnline: false,
        isConnected: false
      }));
      
      toast.warning('You\'re offline', {
        description: 'Changes will be saved when connection is restored.',
        duration: 5000
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check initial status
    setConnectionStatus(prev => ({
      ...prev,
      isOnline: navigator.onLine
    }));

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Add action to offline queue
  const queueOfflineAction = (action: string, data: any, maxRetries = 3) => {
    const item: OfflineQueueItem = {
      id: `${action}-${Date.now()}-${Math.random()}`,
      action,
      data,
      timestamp: new Date(),
      retries: 0,
      maxRetries
    };

    setOfflineQueue(prev => [...prev, item]);
    
    // Try to store in localStorage for persistence
    try {
      const existingQueue = JSON.parse(localStorage.getItem('offlineQueue') || '[]');
      existingQueue.push(item);
      localStorage.setItem('offlineQueue', JSON.stringify(existingQueue));
    } catch (error) {
      console.warn('Failed to persist offline queue:', error);
    }
  };

  // Process offline queue
  const processOfflineQueue = async () => {
    if (isProcessingQueue || offlineQueue.length === 0 || !connectionStatus.isOnline) {
      return;
    }

    setIsProcessingQueue(true);
    let successCount = 0;
    let failureCount = 0;

    // Process items one by one
    for (const item of offlineQueue) {
      try {
        await processOfflineItem(item);
        successCount++;
        
        // Remove from queue after successful processing
        setOfflineQueue(prev => prev.filter(queueItem => queueItem.id !== item.id));
        
      } catch (error) {
        console.error('Failed to process offline item:', error);
        
        // Increment retry count
        const updatedItem = { ...item, retries: item.retries + 1 };
        
        if (updatedItem.retries >= updatedItem.maxRetries) {
          // Remove from queue if max retries reached
          setOfflineQueue(prev => prev.filter(queueItem => queueItem.id !== item.id));
          failureCount++;
        } else {
          // Update retry count
          setOfflineQueue(prev => 
            prev.map(queueItem => queueItem.id === item.id ? updatedItem : queueItem)
          );
        }
      }
    }

    // Update localStorage
    try {
      localStorage.setItem('offlineQueue', JSON.stringify(offlineQueue));
    } catch (error) {
      console.warn('Failed to update persisted offline queue:', error);
    }

    setIsProcessingQueue(false);

    // Show results
    if (successCount > 0) {
      toast.success(`Synced ${successCount} pending changes`);
    }
    
    if (failureCount > 0) {
      toast.error(`Failed to sync ${failureCount} changes. Please try again later.`);
    }
  };

  // Process individual offline item
  const processOfflineItem = async (item: OfflineQueueItem): Promise<void> => {
    // This would contain the actual API calls based on action type
    switch (item.action) {
      case 'create_interview':
        // await createInterviewAPI(item.data);
        break;
      case 'update_interview':
        // await updateInterviewAPI(item.data);
        break;
      case 'delete_interview':
        // await deleteInterviewAPI(item.data);
        break;
      case 'submit_feedback':
        // await submitFeedbackAPI(item.data);
        break;
      default:
        console.warn('Unknown offline action:', item.action);
    }
  };

  // Load persisted offline queue on mount
  useEffect(() => {
    try {
      const persistedQueue = JSON.parse(localStorage.getItem('offlineQueue') || '[]');
      setOfflineQueue(persistedQueue);
    } catch (error) {
      console.warn('Failed to load persisted offline queue:', error);
    }
  }, []);

  // Auto-process queue when online
  useEffect(() => {
    if (connectionStatus.isOnline && offlineQueue.length > 0) {
      const timer = setTimeout(() => {
        processOfflineQueue();
      }, 1000); // Wait 1 second after coming online

      return () => clearTimeout(timer);
    }
  }, [connectionStatus.isOnline, offlineQueue.length]);

  return {
    connectionStatus,
    offlineQueue,
    isProcessingQueue,
    queueOfflineAction,
    processOfflineQueue,
    clearOfflineQueue: () => {
      setOfflineQueue([]);
      try {
        localStorage.removeItem('offlineQueue');
      } catch (error) {
        console.warn('Failed to clear persisted offline queue:', error);
      }
    }
  };
}

// Hook for checking if we should use cached data vs real-time data
export function useCacheStrategy() {
  const { connectionStatus } = useOfflineSupport();
  
  return {
    shouldUseCache: !connectionStatus.isOnline || !connectionStatus.isConnected,
    cacheFirst: !connectionStatus.isOnline,
    networkFirst: connectionStatus.isOnline && connectionStatus.isConnected
  };
}
