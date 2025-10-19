/**
 * Data Layer Monitoring and Health Check System
 * Comprehensive monitoring for data layer operations, migration status, and system health
 */

import { DataLayerServiceFactory } from '../services/DataLayerServiceFactory';
import { metricsCollector } from '../utils/integration';
import { unifiedConfigService } from '@/lib/services/unified-config-service';

export interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency?: number;
  error?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface DataLayerHealthReport {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: HealthCheckResult[];
  metrics: {
    totalOperations: number;
    successRate: number;
    averageLatency: number;
    errorRate: number;
  };
  alerts: Alert[];
}

export interface Alert {
  level: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: string;
  service?: string;
  metadata?: Record<string, any>;
}

export interface MigrationMetrics {
  currentPhase: string;
  migrationProgress?: {
    totalDocuments: number;
    processedDocuments: number;
    progressPercentage: number;
    estimatedTimeRemaining?: number;
  };
  dualWriteMetrics: {
    totalDualWrites: number;
    successfulPrimary: number;
    successfulSecondary: number;
    inconsistencies: number;
    averageLatency: number;
  };
  dataConsistency: {
    lastValidationTime?: string;
    consistentDocuments: number;
    totalValidated: number;
    inconsistencyRate: number;
  };
}

export interface PerformanceMetrics {
  operationMetrics: Record<string, {
    count: number;
    averageLatency: number;
    successRate: number;
    p95Latency: number;
    p99Latency: number;
  }>;
  throughput: {
    readsPerSecond: number;
    writesPerSecond: number;
    totalOperationsPerSecond: number;
  };
  resourceUtilization: {
    memoryUsage?: number;
    cpuUsage?: number;
    connectionCount?: number;
  };
}

/**
 * Main Data Layer Monitor class
 */
export class DataLayerMonitor {
  private static instance: DataLayerMonitor;
  private alerts: Alert[] = [];
  private healthHistory: HealthCheckResult[] = [];
  private readonly MAX_HEALTH_HISTORY = 100;
  private readonly MAX_ALERTS = 50;

  static getInstance(): DataLayerMonitor {
    if (!DataLayerMonitor.instance) {
      DataLayerMonitor.instance = new DataLayerMonitor();
    }
    return DataLayerMonitor.instance;
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(options: {
    includePerformanceMetrics?: boolean;
    includeDetailedChecks?: boolean;
  } = {}): Promise<DataLayerHealthReport> {
    const startTime = Date.now();
    const services: HealthCheckResult[] = [];
    const alerts: Alert[] = [];

    try {
      console.log('Starting data layer health check...');

      // Check data layer factory
      const factoryCheck = await this.checkDataLayerFactory();
      services.push(factoryCheck);

      // Check individual storage systems
      const storageChecks = await this.checkStorageSystems();
      services.push(...storageChecks);

      // Check migration status
      const migrationCheck = await this.checkMigrationHealth();
      services.push(migrationCheck);

      // Perform detailed checks if requested
      if (options.includeDetailedChecks) {
        const detailedChecks = await this.performDetailedChecks();
        services.push(...detailedChecks);
      }

      // Get current metrics
      const currentMetrics = metricsCollector.getMetrics();

      // Determine overall health
      const unhealthyServices = services.filter(s => s.status === 'unhealthy');
      const degradedServices = services.filter(s => s.status === 'degraded');
      
      let overall: 'healthy' | 'degraded' | 'unhealthy';
      if (unhealthyServices.length > 0) {
        overall = 'unhealthy';
        alerts.push({
          level: 'critical',
          message: `${unhealthyServices.length} services are unhealthy`,
          timestamp: new Date().toISOString(),
          metadata: { unhealthyServices: unhealthyServices.map(s => s.service) }
        });
      } else if (degradedServices.length > 0) {
        overall = 'degraded';
        alerts.push({
          level: 'warning',
          message: `${degradedServices.length} services are degraded`,
          timestamp: new Date().toISOString(),
          metadata: { degradedServices: degradedServices.map(s => s.service) }
        });
      } else {
        overall = 'healthy';
      }

      // Check performance metrics for alerts
      this.checkPerformanceAlerts(currentMetrics, alerts);

      // Store alerts
      this.alerts.unshift(...alerts);
      if (this.alerts.length > this.MAX_ALERTS) {
        this.alerts = this.alerts.slice(0, this.MAX_ALERTS);
      }

      // Store health history
      const healthSummary: HealthCheckResult = {
        service: 'overall',
        status: overall,
        latency: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        metadata: {
          servicesChecked: services.length,
          totalLatency: Date.now() - startTime
        }
      };
      
      this.healthHistory.unshift(healthSummary);
      if (this.healthHistory.length > this.MAX_HEALTH_HISTORY) {
        this.healthHistory = this.healthHistory.slice(0, this.MAX_HEALTH_HISTORY);
      }

      console.log(`Health check completed in ${Date.now() - startTime}ms - Status: ${overall}`);

      return {
        overall,
        timestamp: new Date().toISOString(),
        services,
        metrics: {
          totalOperations: currentMetrics.totalOperations,
          successRate: currentMetrics.successRate,
          averageLatency: currentMetrics.averageDuration,
          errorRate: 100 - currentMetrics.successRate
        },
        alerts: this.alerts.slice(0, 10) // Return latest 10 alerts
      };

    } catch (error) {
      console.error('Health check failed:', error);
      
      const errorAlert: Alert = {
        level: 'critical',
        message: `Health check system failure: ${error.message}`,
        timestamp: new Date().toISOString(),
        service: 'monitor'
      };

      this.alerts.unshift(errorAlert);

      return {
        overall: 'unhealthy',
        timestamp: new Date().toISOString(),
        services: [{
          service: 'health-check-system',
          status: 'unhealthy',
          error: error.message,
          timestamp: new Date().toISOString()
        }],
        metrics: {
          totalOperations: 0,
          successRate: 0,
          averageLatency: 0,
          errorRate: 100
        },
        alerts: [errorAlert]
      };
    }
  }

  /**
   * Get migration metrics
   */
  async getMigrationMetrics(): Promise<MigrationMetrics> {
    try {
      const factory = DataLayerServiceFactory.getInstance();
      const migrationManager = factory.getMigrationManager();
      const currentPhase = await unifiedConfigService.get('data.migrationPhase', 'firestore_only');
      
      const dualWriteMetrics = metricsCollector.getMetrics();
      
      // Get migration progress if available
      let migrationProgress;
      if (migrationManager) {
        // This would need to be implemented to track active migrations
        // For now, return placeholder data
        migrationProgress = {
          totalDocuments: 0,
          processedDocuments: 0,
          progressPercentage: 0
        };
      }

      return {
        currentPhase,
        migrationProgress,
        dualWriteMetrics: {
          totalDualWrites: dualWriteMetrics.totalOperations,
          successfulPrimary: dualWriteMetrics.successfulOperations,
          successfulSecondary: dualWriteMetrics.successfulOperations, // Placeholder
          inconsistencies: dualWriteMetrics.dualWriteInconsistencies,
          averageLatency: dualWriteMetrics.averageDuration
        },
        dataConsistency: {
          lastValidationTime: new Date().toISOString(),
          consistentDocuments: dualWriteMetrics.totalOperations - dualWriteMetrics.dualWriteInconsistencies,
          totalValidated: dualWriteMetrics.totalOperations,
          inconsistencyRate: dualWriteMetrics.totalOperations > 0 
            ? (dualWriteMetrics.dualWriteInconsistencies / dualWriteMetrics.totalOperations) * 100 
            : 0
        }
      };

    } catch (error) {
      console.error('Failed to get migration metrics:', error);
      throw error;
    }
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    const metrics = metricsCollector.getMetrics();
    
    // Calculate operation-specific metrics
    const operationMetrics: Record<string, any> = {};
    Object.entries(metrics.operationBreakdown).forEach(([operation, count]) => {
      operationMetrics[operation] = {
        count,
        averageLatency: metrics.averageDuration, // Simplified
        successRate: metrics.successRate,
        p95Latency: metrics.averageDuration * 1.5, // Estimated
        p99Latency: metrics.averageDuration * 2.0 // Estimated
      };
    });

    return {
      operationMetrics,
      throughput: {
        readsPerSecond: 0, // Would need to be calculated from time-series data
        writesPerSecond: 0,
        totalOperationsPerSecond: 0
      },
      resourceUtilization: {
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
        cpuUsage: process.cpuUsage().system,
        connectionCount: 0 // Would need to be tracked
      }
    };
  }

  /**
   * Get health history
   */
  getHealthHistory(): HealthCheckResult[] {
    return [...this.healthHistory];
  }

  /**
   * Get current alerts
   */
  getCurrentAlerts(): Alert[] {
    return [...this.alerts];
  }

  /**
   * Clear alerts
   */
  clearAlerts(level?: 'info' | 'warning' | 'critical'): void {
    if (level) {
      this.alerts = this.alerts.filter(alert => alert.level !== level);
    } else {
      this.alerts = [];
    }
  }

  // Private methods

  private async checkDataLayerFactory(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const factory = DataLayerServiceFactory.getInstance();
      
      // Test repository access
      await factory.getRepositories();
      
      return {
        service: 'data-layer-factory',
        status: 'healthy',
        latency: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        service: 'data-layer-factory',
        status: 'unhealthy',
        error: error.message,
        latency: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  private async checkStorageSystems(): Promise<HealthCheckResult[]> {
    const results: HealthCheckResult[] = [];
    
    try {
      const factory = DataLayerServiceFactory.getInstance();
      const healthStatus = await factory.performHealthCheck();

      // Firestore check
      results.push({
        service: 'firestore',
        status: healthStatus.firestore.status,
        latency: healthStatus.firestore.latency,
        error: healthStatus.firestore.error,
        timestamp: new Date().toISOString()
      });

      // Cosmos DB check
      results.push({
        service: 'cosmosdb',
        status: healthStatus.cosmosdb.status,
        latency: healthStatus.cosmosdb.latency,
        error: healthStatus.cosmosdb.error,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      results.push({
        service: 'storage-systems',
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }

    return results;
  }

  private async checkMigrationHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const currentPhase = await unifiedConfigService.get('data.migrationPhase', 'firestore_only');
      const factory = DataLayerServiceFactory.getInstance();
      const migrationManager = factory.getMigrationManager();

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      let metadata: Record<string, any> = { currentPhase };

      // Check if migration manager is available when it should be
      const needsMigrationManager = ![
        'firestore_only',
        'cosmos_db_only'
      ].includes(currentPhase);

      if (needsMigrationManager && !migrationManager) {
        status = 'degraded';
        metadata.warning = 'Migration manager not available for current phase';
      }

      return {
        service: 'migration',
        status,
        latency: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        metadata
      };

    } catch (error) {
      return {
        service: 'migration',
        status: 'unhealthy',
        error: error.message,
        latency: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  private async performDetailedChecks(): Promise<HealthCheckResult[]> {
    const results: HealthCheckResult[] = [];

    // Check unified config service
    try {
      const startTime = Date.now();
      await unifiedConfigService.get('test.health.check', 'default');
      
      results.push({
        service: 'unified-config',
        status: 'healthy',
        latency: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      results.push({
        service: 'unified-config',
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }

    // Check repository operations
    try {
      const startTime = Date.now();
      const { resumeRepository } = await DataLayerServiceFactory.getInstance().getRepositories();
      
      // Test basic operations
      const countResult = await resumeRepository.count();
      
      if (countResult.success) {
        results.push({
          service: 'repository-operations',
          status: 'healthy',
          latency: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          metadata: { documentCount: countResult.data }
        });
      } else {
        results.push({
          service: 'repository-operations',
          status: 'degraded',
          error: countResult.error,
          latency: Date.now() - startTime,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      results.push({
        service: 'repository-operations',
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }

    return results;
  }

  private checkPerformanceAlerts(metrics: any, alerts: Alert[]): void {
    // Check success rate
    if (metrics.successRate < 95 && metrics.totalOperations > 10) {
      alerts.push({
        level: 'warning',
        message: `Low success rate: ${metrics.successRate.toFixed(2)}%`,
        timestamp: new Date().toISOString(),
        service: 'performance',
        metadata: { successRate: metrics.successRate, totalOperations: metrics.totalOperations }
      });
    }

    // Check average latency
    if (metrics.averageDuration > 5000) { // 5 seconds
      alerts.push({
        level: metrics.averageDuration > 10000 ? 'critical' : 'warning',
        message: `High latency detected: ${metrics.averageDuration}ms`,
        timestamp: new Date().toISOString(),
        service: 'performance',
        metadata: { averageLatency: metrics.averageDuration }
      });
    }

    // Check inconsistency rate
    if (metrics.dualWriteInconsistencies > 0 && metrics.totalOperations > 0) {
      const inconsistencyRate = (metrics.dualWriteInconsistencies / metrics.totalOperations) * 100;
      
      if (inconsistencyRate > 1) { // More than 1% inconsistency
        alerts.push({
          level: inconsistencyRate > 5 ? 'critical' : 'warning',
          message: `Data inconsistency rate: ${inconsistencyRate.toFixed(2)}%`,
          timestamp: new Date().toISOString(),
          service: 'data-consistency',
          metadata: { 
            inconsistencies: metrics.dualWriteInconsistencies,
            totalOperations: metrics.totalOperations,
            inconsistencyRate 
          }
        });
      }
    }
  }
}

// Export singleton instance
export const dataLayerMonitor = DataLayerMonitor.getInstance();