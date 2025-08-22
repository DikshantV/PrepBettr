/**
 * Configuration Monitoring Service
 * 
 * Provides comprehensive monitoring, metrics, and alerting for the
 * unified configuration system with Application Insights integration.
 */

import { TelemetryClient } from 'applicationinsights';
import { logServerError } from '@/lib/errors';
import { azureCosmosService } from './azure-cosmos-service';

// ===== INTERFACES =====

export interface ConfigMetrics {
  requestCount: number;
  cacheHits: number;
  cacheMisses: number;
  avgLatency: number;
  errorCount: number;
  driftDetected: number;
  syncFailures: number;
}

export interface ConfigAlert {
  id: string;
  type: 'drift' | 'sync_failure' | 'high_latency' | 'error_rate' | 'cache_performance';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  metadata: Record<string, any>;
  timestamp: Date;
  resolved: boolean;
  environment: string;
}

export interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  metrics: ConfigMetrics;
  alerts: ConfigAlert[];
  details?: Record<string, any>;
}

// ===== MONITORING SERVICE =====

class ConfigMonitoringService {
  private telemetryClient: TelemetryClient | null = null;
  private metrics: ConfigMetrics = {
    requestCount: 0,
    cacheHits: 0,
    cacheMisses: 0,
    avgLatency: 0,
    errorCount: 0,
    driftDetected: 0,
    syncFailures: 0
  };
  
  private latencyBuffer: number[] = [];
  private readonly LATENCY_BUFFER_SIZE = 100;
  private readonly ALERT_THRESHOLDS = {
    HIGH_LATENCY_MS: 1000,
    ERROR_RATE_THRESHOLD: 0.05, // 5%
    CACHE_HIT_RATIO_MIN: 0.8,   // 80%
    MAX_DRIFT_COUNT: 5
  };

  constructor() {
    this.initializeTelemetry();
  }

  // ===== INITIALIZATION =====

  private initializeTelemetry(): void {
    try {
      const appInsightsKey = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
      
      if (appInsightsKey) {
        // Application Insights is typically initialized globally
        // This service uses the global instance if available
        const appInsights = require('applicationinsights');
        
        if (appInsights.defaultClient) {
          this.telemetryClient = appInsights.defaultClient;
          console.log('✅ Config monitoring connected to Application Insights');
        } else {
          appInsights.setup(appInsightsKey)
            .setAutoCollectRequests(true)
            .setAutoCollectPerformance(true)
            .setAutoCollectExceptions(true)
            .setAutoCollectDependencies(true)
            .setAutoCollectConsole(true, true)
            .setUseDiskRetryCaching(true)
            .start();
            
          this.telemetryClient = appInsights.defaultClient;
          console.log('✅ Config monitoring initialized Application Insights');
        }
      } else {
        console.warn('⚠️ Application Insights connection string not found - monitoring disabled');
      }
    } catch (error) {
      console.error('❌ Failed to initialize Application Insights:', error);
      logServerError(error as Error, { service: 'config-monitoring', action: 'initialize' });
    }
  }

  // ===== METRICS TRACKING =====

  /**
   * Track configuration request with timing
   */
  trackConfigRequest(key: string, operation: 'get' | 'set' | 'getAll', latency: number, success: boolean): void {
    this.metrics.requestCount++;
    
    // Update latency metrics
    this.latencyBuffer.push(latency);
    if (this.latencyBuffer.length > this.LATENCY_BUFFER_SIZE) {
      this.latencyBuffer.shift();
    }
    this.metrics.avgLatency = this.latencyBuffer.reduce((a, b) => a + b, 0) / this.latencyBuffer.length;
    
    // Track errors
    if (!success) {
      this.metrics.errorCount++;
    }
    
    // Send to Application Insights
    if (this.telemetryClient) {
      this.telemetryClient.trackRequest({
        name: `Config-${operation}`,
        url: `config://${key}`,
        duration: latency,
        resultCode: success ? '200' : '500',
        success,
        properties: {
          configKey: key,
          operation,
          service: 'unified-config'
        },
        measurements: {
          latency,
          cacheHitRatio: this.getCacheHitRatio(),
          requestCount: this.metrics.requestCount
        }
      });
      
      // Track custom metric
      this.telemetryClient.trackMetric({
        name: 'Config.Request.Latency',
        value: latency,
        properties: {
          operation,
          key: key.split('.')[0] // Track by namespace
        }
      });
    }
    
    // Check for alerts
    this.checkLatencyAlert(latency);
    this.checkErrorRateAlert();
  }

  /**
   * Track cache hit/miss
   */
  trackCacheHit(hit: boolean, key: string): void {
    if (hit) {
      this.metrics.cacheHits++;
    } else {
      this.metrics.cacheMisses++;
    }
    
    if (this.telemetryClient) {
      this.telemetryClient.trackEvent({
        name: 'Config.Cache.Access',
        properties: {
          hit: hit.toString(),
          key: key.split('.')[0],
          service: 'unified-config'
        },
        measurements: {
          hitRatio: this.getCacheHitRatio(),
          totalCacheAccess: this.metrics.cacheHits + this.metrics.cacheMisses
        }
      });
    }
    
    // Check cache performance alert
    this.checkCachePerformanceAlert();
  }

  /**
   * Track configuration drift detection
   */
  trackDriftDetection(driftedKeys: string[], totalChecked: number): void {
    this.metrics.driftDetected = driftedKeys.length;
    
    if (this.telemetryClient) {
      this.telemetryClient.trackEvent({
        name: 'Config.Drift.Detection',
        properties: {
          driftedKeys: driftedKeys.join(','),
          service: 'unified-config'
        },
        measurements: {
          driftCount: driftedKeys.length,
          totalChecked,
          driftRatio: driftedKeys.length / totalChecked
        }
      });
    }
    
    // Alert if drift detected
    if (driftedKeys.length > 0) {
      this.createAlert('drift', 'high', `Configuration drift detected in ${driftedKeys.length} keys: ${driftedKeys.join(', ')}`, {
        driftedKeys,
        totalChecked
      });
    }
  }

  /**
   * Track Firebase sync operations
   */
  trackSyncOperation(success: boolean, keysSync: number, duration: number, error?: string): void {
    if (!success) {
      this.metrics.syncFailures++;
    }
    
    if (this.telemetryClient) {
      this.telemetryClient.trackDependency({
        dependencyTypeName: 'Firebase',
        name: 'Config.Sync',
        data: `Sync ${keysSync} keys`,
        duration,
        success,
        properties: {
          keysSync: keysSync.toString(),
          service: 'config-sync',
          error: error || ''
        }
      });
      
      this.telemetryClient.trackMetric({
        name: 'Config.Sync.KeyCount',
        value: keysSync,
        properties: {
          success: success.toString()
        }
      });
    }
    
    // Alert on sync failures
    if (!success) {
      this.createAlert('sync_failure', 'medium', `Firebase sync failed: ${error || 'Unknown error'}`, {
        keysSync,
        duration,
        error
      });
    }
  }

  /**
   * Track configuration changes
   */
  trackConfigChange(key: string, oldValue: any, newValue: any, changedBy: string, environment: string): void {
    if (this.telemetryClient) {
      this.telemetryClient.trackEvent({
        name: 'Config.Change',
        properties: {
          key,
          changedBy,
          environment,
          service: 'unified-config',
          hasOldValue: (oldValue !== null && oldValue !== undefined).toString(),
          valueType: typeof newValue
        },
        measurements: {
          changeTimestamp: Date.now()
        }
      });
    }
  }

  // ===== ALERTING =====

  /**
   * Create and process alerts
   */
  private async createAlert(type: ConfigAlert['type'], severity: ConfigAlert['severity'], message: string, metadata: Record<string, any>): Promise<void> {
    const alert: ConfigAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity,
      message,
      metadata,
      timestamp: new Date(),
      resolved: false,
      environment: process.env.NODE_ENV || 'development'
    };
    
    // Store alert in Cosmos DB
    try {
      await azureCosmosService.createDocument('configAlerts', {
        ...alert,
        _partitionKey: alert.type
      });
    } catch (error) {
      console.error('Failed to store alert:', error);
    }
    
    // Send to Application Insights as exception for high/critical severity
    if (this.telemetryClient && (severity === 'high' || severity === 'critical')) {
      this.telemetryClient.trackException({
        exception: new Error(`Config Alert [${severity.toUpperCase()}]: ${message}`),
        properties: {
          alertId: alert.id,
          alertType: type,
          severity,
          environment: alert.environment,
          service: 'unified-config'
        },
        measurements: metadata
      });
    }
    
    // Send to notification channels
    await this.sendAlertNotification(alert);
    
    console.warn(`🚨 Config Alert [${severity.toUpperCase()}]: ${message}`);
  }

  /**
   * Check for latency alerts
   */
  private checkLatencyAlert(latency: number): void {
    if (latency > this.ALERT_THRESHOLDS.HIGH_LATENCY_MS) {
      this.createAlert('high_latency', 'medium', `High configuration latency detected: ${latency}ms`, {
        latency,
        threshold: this.ALERT_THRESHOLDS.HIGH_LATENCY_MS
      });
    }
  }

  /**
   * Check for error rate alerts
   */
  private checkErrorRateAlert(): void {
    const errorRate = this.metrics.requestCount > 0 ? this.metrics.errorCount / this.metrics.requestCount : 0;
    
    if (errorRate > this.ALERT_THRESHOLDS.ERROR_RATE_THRESHOLD && this.metrics.requestCount > 10) {
      this.createAlert('error_rate', 'high', `High configuration error rate: ${(errorRate * 100).toFixed(2)}%`, {
        errorRate,
        errorCount: this.metrics.errorCount,
        requestCount: this.metrics.requestCount
      });
    }
  }

  /**
   * Check for cache performance alerts
   */
  private checkCachePerformanceAlert(): void {
    const hitRatio = this.getCacheHitRatio();
    const totalRequests = this.metrics.cacheHits + this.metrics.cacheMisses;
    
    if (hitRatio < this.ALERT_THRESHOLDS.CACHE_HIT_RATIO_MIN && totalRequests > 50) {
      this.createAlert('cache_performance', 'medium', `Low cache hit ratio: ${(hitRatio * 100).toFixed(2)}%`, {
        hitRatio,
        cacheHits: this.metrics.cacheHits,
        cacheMisses: this.metrics.cacheMisses
      });
    }
  }

  // ===== NOTIFICATIONS =====

  /**
   * Send alert notifications to configured channels
   */
  private async sendAlertNotification(alert: ConfigAlert): Promise<void> {
    try {
      // Slack webhook notification
      const slackWebhook = process.env.SLACK_WEBHOOK_URL;
      if (slackWebhook && (alert.severity === 'high' || alert.severity === 'critical')) {
        await this.sendSlackNotification(alert, slackWebhook);
      }
      
      // Email notification (could be implemented)
      // await this.sendEmailNotification(alert);
      
      // Microsoft Teams notification (could be implemented)
      // await this.sendTeamsNotification(alert);
      
    } catch (error) {
      console.error('Failed to send alert notification:', error);
    }
  }

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(alert: ConfigAlert, webhookUrl: string): Promise<void> {
    const payload = {
      text: `🚨 Configuration Alert: ${alert.message}`,
      attachments: [
        {
          color: this.getAlertColor(alert.severity),
          fields: [
            { title: 'Alert Type', value: alert.type, short: true },
            { title: 'Severity', value: alert.severity.toUpperCase(), short: true },
            { title: 'Environment', value: alert.environment, short: true },
            { title: 'Timestamp', value: alert.timestamp.toISOString(), short: true }
          ],
          footer: 'PrepBettr Config Monitoring'
        }
      ]
    };
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`Slack notification failed: ${response.statusText}`);
    }
  }

  /**
   * Get alert color for Slack
   */
  private getAlertColor(severity: ConfigAlert['severity']): string {
    switch (severity) {
      case 'critical': return 'danger';
      case 'high': return 'warning';
      case 'medium': return 'warning';
      case 'low': return 'good';
      default: return 'good';
    }
  }

  // ===== HEALTH CHECK =====

  /**
   * Perform comprehensive health check
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const alerts = await this.getActiveAlerts();
    const status = this.calculateHealthStatus(alerts);
    
    return {
      service: 'unified-config',
      status,
      timestamp: new Date(),
      metrics: { ...this.metrics },
      alerts,
      details: {
        cacheHitRatio: this.getCacheHitRatio(),
        avgLatency: this.metrics.avgLatency,
        errorRate: this.metrics.requestCount > 0 ? this.metrics.errorCount / this.metrics.requestCount : 0,
        uptime: process.uptime()
      }
    };
  }

  /**
   * Get active alerts
   */
  private async getActiveAlerts(): Promise<ConfigAlert[]> {
    try {
      const alerts = await azureCosmosService.queryDocuments<ConfigAlert>(
        'configAlerts',
        'SELECT * FROM c WHERE c.resolved = false AND c.timestamp >= @cutoff ORDER BY c.timestamp DESC',
        [{ name: '@cutoff', value: new Date(Date.now() - 24 * 60 * 60 * 1000) }] // Last 24 hours
      );
      return alerts.slice(0, 10); // Limit to 10 most recent
    } catch (error) {
      console.error('Failed to get active alerts:', error);
      return [];
    }
  }

  /**
   * Calculate overall health status
   */
  private calculateHealthStatus(alerts: ConfigAlert[]): 'healthy' | 'degraded' | 'unhealthy' {
    const criticalAlerts = alerts.filter(a => a.severity === 'critical');
    const highAlerts = alerts.filter(a => a.severity === 'high');
    
    if (criticalAlerts.length > 0) return 'unhealthy';
    if (highAlerts.length > 2) return 'unhealthy';
    if (alerts.length > 5) return 'degraded';
    
    // Check metrics
    const errorRate = this.metrics.requestCount > 0 ? this.metrics.errorCount / this.metrics.requestCount : 0;
    const cacheHitRatio = this.getCacheHitRatio();
    
    if (errorRate > 0.1 || cacheHitRatio < 0.5 || this.metrics.avgLatency > 2000) {
      return 'degraded';
    }
    
    return 'healthy';
  }

  // ===== UTILITY METHODS =====

  /**
   * Get current cache hit ratio
   */
  private getCacheHitRatio(): number {
    const total = this.metrics.cacheHits + this.metrics.cacheMisses;
    return total > 0 ? this.metrics.cacheHits / total : 0;
  }

  /**
   * Get current metrics
   */
  getMetrics(): ConfigMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics (for testing or periodic reset)
   */
  resetMetrics(): void {
    this.metrics = {
      requestCount: 0,
      cacheHits: 0,
      cacheMisses: 0,
      avgLatency: 0,
      errorCount: 0,
      driftDetected: 0,
      syncFailures: 0
    };
    this.latencyBuffer = [];
  }

  /**
   * Flush telemetry data
   */
  flush(): Promise<void> {
    return new Promise((resolve) => {
      if (this.telemetryClient) {
        this.telemetryClient.flush();
        // Flush is synchronous, so we can resolve immediately
        resolve();
      } else {
        resolve();
      }
    });
  }
}

// ===== SINGLETON INSTANCE =====

export const configMonitoringService = new ConfigMonitoringService();
export default configMonitoringService;
