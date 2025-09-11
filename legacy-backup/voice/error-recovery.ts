/**
 * Advanced error recovery and network resilience for voice interviews
 */

import { logger } from '../utils/logger';

export interface ErrorRecoveryOptions {
  maxRetries?: number;
  retryDelay?: number;
  fallbackEnabled?: boolean;
  offlineMode?: boolean;
}

export interface ServiceHealth {
  speechToText: 'online' | 'degraded' | 'offline';
  textToSpeech: 'online' | 'degraded' | 'offline';
  openAI: 'online' | 'degraded' | 'offline';
  network: 'online' | 'offline';
}

export class VoiceInterviewErrorRecovery {
  private retryAttempts: Map<string, number> = new Map();
  private serviceHealth: ServiceHealth = {
    speechToText: 'online',
    textToSpeech: 'online',
    openAI: 'online',
    network: 'online'
  };
  private offlineModeEnabled = false;

  constructor(private options: ErrorRecoveryOptions = {}) {
    this.options = {
      maxRetries: 3,
      retryDelay: 1000,
      fallbackEnabled: true,
      offlineMode: false,
      ...options
    };

    // Monitor network status
    this.initNetworkMonitoring();
  }

  /**
   * Initialize network connectivity monitoring
   */
  private initNetworkMonitoring(): void {
    if (typeof window !== 'undefined') {
      // Monitor online/offline events
      window.addEventListener('online', () => {
        logger.info('Network connection restored');
        this.serviceHealth.network = 'online';
        this.checkServicesHealth();
      });

      window.addEventListener('offline', () => {
        logger.warn('Network connection lost - entering offline mode');
        this.serviceHealth.network = 'offline';
        this.enableOfflineMode();
      });

      // Initial network status
      this.serviceHealth.network = navigator.onLine ? 'online' : 'offline';
    }
  }

  /**
   * Handle API errors with intelligent retry and fallback
   */
  async handleApiError<T>(
    operation: () => Promise<T>,
    operationType: keyof ServiceHealth,
    fallback?: () => Promise<T>
  ): Promise<T> {
    const operationKey = `${operationType}-${Date.now()}`;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= (this.options.maxRetries || 3); attempt++) {
      try {
        // Check if we should attempt the operation
        if (this.serviceHealth.network === 'offline' && this.offlineModeEnabled) {
          throw new Error('Service unavailable in offline mode');
        }

        const result = await operation();
        
        // Success - reset retry count and update service health
        this.retryAttempts.delete(operationKey);
        this.updateServiceHealth(operationType, 'online');
        
        return result;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        logger.error(`${operationType} attempt ${attempt} failed`, {
          error: lastError.message,
          attempt,
          maxRetries: this.options.maxRetries
        });

        // Update service health based on error type
        this.updateServiceHealthFromError(operationType, lastError);

        // If this was the last attempt, break out of loop
        if (attempt === this.options.maxRetries) {
          break;
        }

        // Calculate exponential backoff delay
        const delay = (this.options.retryDelay || 1000) * Math.pow(2, attempt - 1);
        await this.sleep(delay);
      }
    }

    // All retries failed - attempt fallback if available
    if (fallback && this.options.fallbackEnabled) {
      try {
        logger.info(`Attempting fallback for ${operationType}`);
        return await fallback();
      } catch (fallbackError) {
        logger.error(`Fallback also failed for ${operationType}`, fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError)));
      }
    }

    // Final failure
    this.updateServiceHealth(operationType, 'offline');
    throw lastError || new Error(`${operationType} failed after ${this.options.maxRetries} attempts`);
  }

  /**
   * Update service health status
   */
  private updateServiceHealth(service: keyof ServiceHealth, status: ServiceHealth[keyof ServiceHealth]): void {
    // Validate status for network service (only accepts online/offline)
    let validatedStatus = status;
    if (service === 'network' && status === 'degraded') {
      validatedStatus = 'offline'; // Degrade network service to offline
    }
    
    if (this.serviceHealth[service] !== validatedStatus) {
      (this.serviceHealth as any)[service] = validatedStatus;
      logger.info(`Service health updated`, { service, status: validatedStatus });
      
      // Emit custom event for UI updates
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('serviceHealthChanged', {
          detail: { service, status: validatedStatus, allServices: this.serviceHealth }
        }));
      }
    }
  }

  /**
   * Update service health based on error characteristics
   */
  private updateServiceHealthFromError(service: keyof ServiceHealth, error: Error): void {
    const errorMessage = error.message.toLowerCase();
    
    // Network-related errors
    if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      this.updateServiceHealth(service, 'offline');
    }
    // Rate limiting or quota errors
    else if (errorMessage.includes('quota') || errorMessage.includes('rate limit')) {
      this.updateServiceHealth(service, 'degraded');
    }
    // Authentication errors
    else if (errorMessage.includes('auth') || errorMessage.includes('unauthorized')) {
      this.updateServiceHealth(service, 'offline');
    }
    // Timeout errors
    else if (errorMessage.includes('timeout')) {
      this.updateServiceHealth(service, 'degraded');
    }
    // Generic service unavailable
    else if (errorMessage.includes('503') || errorMessage.includes('502') || errorMessage.includes('504')) {
      this.updateServiceHealth(service, 'degraded');
    }
  }

  /**
   * Enable offline mode with graceful degradation
   */
  private enableOfflineMode(): void {
    this.offlineModeEnabled = true;
    
    // Update all service statuses
    Object.keys(this.serviceHealth).forEach(service => {
      if (service !== 'network') {
        this.updateServiceHealth(service as keyof ServiceHealth, 'offline');
      }
    });

    logger.info('Offline mode enabled - voice interviews will use fallback mechanisms');
  }

  /**
   * Check health of all services after network restoration
   */
  private async checkServicesHealth(): Promise<void> {
    if (this.serviceHealth.network === 'offline') return;

    const healthChecks = [
      this.checkServiceHealth('speechToText', '/api/voice/stream'),
      this.checkServiceHealth('textToSpeech', '/api/voice/tts'),
      this.checkServiceHealth('openAI', '/api/voice/conversation')
    ];

    await Promise.allSettled(healthChecks);
  }

  /**
   * Check individual service health
   */
  private async checkServiceHealth(service: keyof ServiceHealth, endpoint: string): Promise<void> {
    try {
      const response = await fetch(endpoint, { method: 'GET' });
      this.updateServiceHealth(service, response.ok ? 'online' : 'degraded');
    } catch {
      this.updateServiceHealth(service, 'offline');
    }
  }

  /**
   * Get current service health status
   */
  getServiceHealth(): ServiceHealth {
    return { ...this.serviceHealth };
  }

  /**
   * Check if a service is available
   */
  isServiceAvailable(service: keyof ServiceHealth): boolean {
    return this.serviceHealth[service] === 'online' || this.serviceHealth[service] === 'degraded';
  }

  /**
   * Get user-friendly error message
   */
  getUserFriendlyErrorMessage(service: keyof ServiceHealth, error?: Error): string {
    if (this.serviceHealth.network === 'offline') {
      return 'You appear to be offline. Please check your internet connection and try again.';
    }

    const serviceHealth = this.serviceHealth[service];
    
    switch (serviceHealth) {
      case 'offline':
        switch (service) {
          case 'speechToText':
            return 'Speech recognition is currently unavailable. You can type your responses instead.';
          case 'textToSpeech':
            return 'Audio playback is unavailable. You can read the AI responses as text.';
          case 'openAI':
            return 'The AI interviewer is temporarily unavailable. Please try again later.';
          default:
            return 'This service is currently unavailable. Please try again later.';
        }
      
      case 'degraded':
        return 'Service is experiencing high demand. Response times may be slower than usual.';
        
      default:
        return error?.message || 'An unexpected error occurred. Please try again.';
    }
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Reset all error counters and health status
   */
  reset(): void {
    this.retryAttempts.clear();
    this.serviceHealth = {
      speechToText: 'online',
      textToSpeech: 'online',
      openAI: 'online',
      network: navigator?.onLine ? 'online' : 'offline'
    };
    this.offlineModeEnabled = false;
    
    logger.info('Error recovery system reset');
  }
}

// Export singleton instance
export const voiceErrorRecovery = new VoiceInterviewErrorRecovery();
