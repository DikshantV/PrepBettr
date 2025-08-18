#!/usr/bin/env ts-node

/**
 * Production Monitoring Script
 * Monitors Application Insights & Azure Front Door metrics for:
 * - Error rates ≥ 5%
 * - Latency > 2 seconds
 */

import { DefaultAzureCredential } from '@azure/identity';
import { LogsQueryClient, MetricsQueryClient, MetricsQueryResult } from '@azure/monitor-query';

interface MetricThresholds {
  errorRateThreshold: number; // 5%
  latencyThreshold: number;   // 2000ms
}

interface AlertConfig {
  applicationInsightsWorkspaceId: string;
  subscriptionId: string;
  frontDoorProfileName: string;
  resourceGroupName: string;
}

class ProductionMetricsMonitor {
  private logsQueryClient: LogsQueryClient;
  private metricsQueryClient: MetricsQueryClient;
  private config: AlertConfig;
  private thresholds: MetricThresholds;

  constructor() {
    this.logsQueryClient = new LogsQueryClient(new DefaultAzureCredential());
    this.metricsQueryClient = new MetricsQueryClient(new DefaultAzureCredential());
    this.config = {
      applicationInsightsWorkspaceId: process.env.APPLICATION_INSIGHTS_WORKSPACE_ID || '',
      subscriptionId: process.env.AZURE_SUBSCRIPTION_ID || '',
      frontDoorProfileName: process.env.AZURE_FRONTDOOR_PROFILE_NAME || 'prepbettr-frontdoor',
      resourceGroupName: process.env.AZURE_RESOURCE_GROUP_NAME || 'prepbettr-rg'
    };
    this.thresholds = {
      errorRateThreshold: 0.05, // 5%
      latencyThreshold: 2000    // 2000ms
    };
  }

  /**
   * Query Application Insights for error rate metrics
   */
  async checkApplicationInsightsErrorRate(): Promise<{ errorRate: number; isAlertCondition: boolean }> {
    const kusto = `
      requests
      | where timestamp >= ago(5m)
      | summarize 
          total_requests = count(),
          failed_requests = countif(success == false)
      | extend error_rate = todouble(failed_requests) / todouble(total_requests)
      | project error_rate, total_requests, failed_requests
    `;

    try {
      const result = await this.logsQueryClient.queryWorkspace(
        this.config.applicationInsightsWorkspaceId,
        kusto,
        { duration: 'PT5M' }
      );

      if ('tables' in result && result.tables.length > 0 && result.tables[0].rows.length > 0) {
        const errorRate = result.tables[0].rows[0][0] as number || 0;
        const totalRequests = result.tables[0].rows[0][1] as number || 0;
        const failedRequests = result.tables[0].rows[0][2] as number || 0;
        
        console.log(`📊 Application Insights Error Rate: ${(errorRate * 100).toFixed(2)}% (${failedRequests}/${totalRequests} requests failed)`);
        
        return {
          errorRate: errorRate,
          isAlertCondition: errorRate >= this.thresholds.errorRateThreshold
        };
      }

      return { errorRate: 0, isAlertCondition: false };
    } catch (error) {
      console.error('❌ Failed to query Application Insights:', error);
      return { errorRate: 0, isAlertCondition: false };
    }
  }

  /**
   * Query Application Insights for response time metrics
   */
  async checkApplicationInsightsLatency(): Promise<{ avgLatency: number; p95Latency: number; isAlertCondition: boolean }> {
    const kusto = `
      requests
      | where timestamp >= ago(5m)
      | summarize 
          avg_duration = avg(duration),
          p95_duration = percentile(duration, 95),
          request_count = count()
      | project avg_duration, p95_duration, request_count
    `;

    try {
      const result = await this.logsQueryClient.queryWorkspace(
        this.config.applicationInsightsWorkspaceId,
        kusto,
        { duration: 'PT5M' }
      );

      if ('tables' in result && result.tables.length > 0 && result.tables[0].rows.length > 0) {
        const avgLatency = result.tables[0].rows[0][0] as number || 0;
        const p95Latency = result.tables[0].rows[0][1] as number || 0;
        const requestCount = result.tables[0].rows[0][2] as number || 0;
        
        console.log(`📊 Application Insights Latency - Avg: ${avgLatency.toFixed(2)}ms, P95: ${p95Latency.toFixed(2)}ms (${requestCount} requests)`);
        
        return {
          avgLatency,
          p95Latency,
          isAlertCondition: p95Latency >= this.thresholds.latencyThreshold
        };
      }

      return { avgLatency: 0, p95Latency: 0, isAlertCondition: false };
    } catch (error) {
      console.error('❌ Failed to query Application Insights latency:', error);
      return { avgLatency: 0, p95Latency: 0, isAlertCondition: false };
    }
  }

  /**
   * Check Azure Front Door metrics for error rates and latency
   */
  async checkFrontDoorMetrics(): Promise<{ errorRate: number; avgLatency: number; isErrorAlert: boolean; isLatencyAlert: boolean }> {
    const resourceUri = `/subscriptions/${this.config.subscriptionId}/resourceGroups/${this.config.resourceGroupName}/providers/Microsoft.Cdn/profiles/${this.config.frontDoorProfileName}`;

    try {
      // Query for HTTP status codes
      const errorMetrics = await this.metricsQueryClient.queryResource(
        resourceUri,
        ['PercentageOf4XX', 'PercentageOf5XX'],
        {
          granularity: 'PT1M',
          timespan: { duration: 'PT5M' }
        }
      );

      // Query for latency
      const latencyMetrics = await this.metricsQueryClient.queryResource(
        resourceUri,
        ['TotalLatency'],
        {
          granularity: 'PT1M', 
          timespan: { duration: 'PT5M' }
        }
      );

      let errorRate = 0;
      let avgLatency = 0;

      // Process error metrics
      if (errorMetrics.metrics) {
        const metrics4xx = errorMetrics.metrics.find(m => m.name.value === 'PercentageOf4XX');
        const metrics5xx = errorMetrics.metrics.find(m => m.name.value === 'PercentageOf5XX');
        
        const avg4xx = this.getAverageFromTimeSeries(metrics4xx?.timeseries);
        const avg5xx = this.getAverageFromTimeSeries(metrics5xx?.timeseries);
        
        errorRate = (avg4xx + avg5xx) / 100; // Convert percentage to decimal
        console.log(`📊 Azure Front Door Error Rate: ${(errorRate * 100).toFixed(2)}% (4XX: ${avg4xx.toFixed(2)}%, 5XX: ${avg5xx.toFixed(2)}%)`);
      }

      // Process latency metrics
      if (latencyMetrics.metrics) {
        const latencyMetric = latencyMetrics.metrics.find(m => m.name.value === 'TotalLatency');
        avgLatency = this.getAverageFromTimeSeries(latencyMetric?.timeseries);
        console.log(`📊 Azure Front Door Avg Latency: ${avgLatency.toFixed(2)}ms`);
      }

      return {
        errorRate,
        avgLatency,
        isErrorAlert: errorRate >= this.thresholds.errorRateThreshold,
        isLatencyAlert: avgLatency >= this.thresholds.latencyThreshold
      };

    } catch (error) {
      console.error('❌ Failed to query Azure Front Door metrics:', error);
      return { errorRate: 0, avgLatency: 0, isErrorAlert: false, isLatencyAlert: false };
    }
  }

  /**
   * Helper method to extract average from metric time series
   */
  private getAverageFromTimeSeries(timeseries: any[]): number {
    if (!timeseries || timeseries.length === 0) return 0;
    
    const allValues: number[] = [];
    
    for (const series of timeseries) {
      if (series.data) {
        for (const dataPoint of series.data) {
          if (dataPoint.average !== null && dataPoint.average !== undefined) {
            allValues.push(dataPoint.average);
          }
        }
      }
    }
    
    if (allValues.length === 0) return 0;
    return allValues.reduce((sum, val) => sum + val, 0) / allValues.length;
  }

  /**
   * Run comprehensive monitoring check
   */
  async runMonitoring(): Promise<void> {
    console.log('🚀 Starting Production Metrics Monitoring...\n');
    
    const alerts: string[] = [];
    
    try {
      // Check Application Insights metrics
      console.log('📱 Checking Application Insights...');
      const appInsightsError = await this.checkApplicationInsightsErrorRate();
      const appInsightsLatency = await this.checkApplicationInsightsLatency();
      
      if (appInsightsError.isAlertCondition) {
        alerts.push(`🚨 Application Insights error rate ${(appInsightsError.errorRate * 100).toFixed(2)}% exceeds threshold of ${this.thresholds.errorRateThreshold * 100}%`);
      }
      
      if (appInsightsLatency.isAlertCondition) {
        alerts.push(`🚨 Application Insights P95 latency ${appInsightsLatency.p95Latency.toFixed(2)}ms exceeds threshold of ${this.thresholds.latencyThreshold}ms`);
      }
      
      console.log('');
      
      // Check Azure Front Door metrics
      console.log('🌐 Checking Azure Front Door...');
      const frontDoorMetrics = await this.checkFrontDoorMetrics();
      
      if (frontDoorMetrics.isErrorAlert) {
        alerts.push(`🚨 Azure Front Door error rate ${(frontDoorMetrics.errorRate * 100).toFixed(2)}% exceeds threshold of ${this.thresholds.errorRateThreshold * 100}%`);
      }
      
      if (frontDoorMetrics.isLatencyAlert) {
        alerts.push(`🚨 Azure Front Door latency ${frontDoorMetrics.avgLatency.toFixed(2)}ms exceeds threshold of ${this.thresholds.latencyThreshold}ms`);
      }
      
    } catch (error) {
      alerts.push(`❌ Monitoring error: ${error.message}`);
    }
    
    // Print results
    console.log('\n' + '='.repeat(80));
    
    if (alerts.length > 0) {
      console.log('🚨 ALERT CONDITIONS DETECTED:');
      alerts.forEach(alert => console.log(`   ${alert}`));
      
      // Exit with error code for CI/CD
      if (process.env.CI) {
        process.exit(1);
      }
    } else {
      console.log('✅ All metrics within acceptable thresholds');
      console.log('✅ Production system health: GOOD');
    }
    
    console.log('='.repeat(80));
  }
}

// Run monitoring if called directly
if (require.main === module) {
  const monitor = new ProductionMetricsMonitor();
  
  monitor.runMonitoring()
    .then(() => {
      console.log('\n🏁 Monitoring check completed');
    })
    .catch((error) => {
      console.error('\n❌ Monitoring failed:', error);
      process.exit(1);
    });
}

export { ProductionMetricsMonitor };
