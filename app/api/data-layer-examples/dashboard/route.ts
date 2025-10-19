/**
 * Data Layer Monitoring Dashboard API
 * Provides comprehensive monitoring data for the data layer dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { dataLayerMonitor } from '@/lib/data-layer/monitoring/DataLayerMonitor';
import { initializeDataLayerFromConfig, metricsCollector } from '@/lib/data-layer/utils/integration';
import { unifiedConfigService } from '@/lib/services/unified-config-service';

/**
 * GET /api/data-layer-examples/dashboard
 * Get comprehensive dashboard data
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const view = searchParams.get('view') || 'overview';
    const timeRange = searchParams.get('timeRange') || '1h';

    switch (view) {
      case 'overview':
        return await getDashboardOverview();
      
      case 'health':
        return await getHealthDashboard();
      
      case 'performance':
        return await getPerformanceDashboard(timeRange);
      
      case 'migration':
        return await getMigrationDashboard();
      
      case 'alerts':
        return await getAlertsDashboard();
      
      default:
        return await getDashboardOverview();
    }

  } catch (error) {
    console.error('Dashboard API Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch dashboard data',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/data-layer-examples/dashboard
 * Perform dashboard actions (clear alerts, refresh data, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, params = {} } = body;

    switch (action) {
      case 'clearAlerts':
        return await clearAlerts(params);
      
      case 'refreshMetrics':
        return await refreshMetrics();
      
      case 'performHealthCheck':
        return await performHealthCheck(params);
      
      case 'exportData':
        return await exportDashboardData(params);
      
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Dashboard Action Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to perform action',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

/**
 * Get dashboard overview with key metrics
 */
async function getDashboardOverview() {
  const [healthReport, migrationMetrics, performanceMetrics] = await Promise.allSettled([
    dataLayerMonitor.performHealthCheck({ includeDetailedChecks: false }),
    dataLayerMonitor.getMigrationMetrics(),
    dataLayerMonitor.getPerformanceMetrics()
  ]);

  // Get current configuration
  const currentConfig = {
    migrationPhase: await unifiedConfigService.get('data.migrationPhase', 'firestore_only'),
    dualWriteEnabled: await unifiedConfigService.get('data.enableDualWrite', false),
    consistencyValidation: await unifiedConfigService.get('data.enableConsistencyValidation', true),
    asyncWrites: await unifiedConfigService.get('data.enableAsyncWrites', true)
  };

  const overview = {
    timestamp: new Date().toISOString(),
    systemStatus: {
      overall: healthReport.status === 'fulfilled' ? healthReport.value.overall : 'unhealthy',
      services: healthReport.status === 'fulfilled' ? healthReport.value.services.length : 0,
      activeAlerts: healthReport.status === 'fulfilled' ? healthReport.value.alerts.length : 0
    },
    configuration: currentConfig,
    keyMetrics: {
      totalOperations: healthReport.status === 'fulfilled' ? healthReport.value.metrics.totalOperations : 0,
      successRate: healthReport.status === 'fulfilled' ? healthReport.value.metrics.successRate : 0,
      averageLatency: healthReport.status === 'fulfilled' ? healthReport.value.metrics.averageLatency : 0,
      inconsistencyRate: migrationMetrics.status === 'fulfilled' ? migrationMetrics.value.dataConsistency.inconsistencyRate : 0
    },
    migration: {
      currentPhase: currentConfig.migrationPhase,
      progressPercentage: migrationMetrics.status === 'fulfilled' 
        ? migrationMetrics.value.migrationProgress?.progressPercentage || 0
        : 0,
      dualWriteActive: currentConfig.dualWriteEnabled
    },
    performance: {
      memoryUsage: performanceMetrics.status === 'fulfilled' 
        ? performanceMetrics.value.resourceUtilization.memoryUsage 
        : 0,
      throughput: performanceMetrics.status === 'fulfilled'
        ? performanceMetrics.value.throughput.totalOperationsPerSecond
        : 0
    }
  };

  return NextResponse.json({
    success: true,
    data: overview,
    view: 'overview'
  });
}

/**
 * Get detailed health dashboard
 */
async function getHealthDashboard() {
  const healthReport = await dataLayerMonitor.performHealthCheck({
    includeDetailedChecks: true,
    includePerformanceMetrics: true
  });

  const healthHistory = dataLayerMonitor.getHealthHistory().slice(0, 20); // Last 20 checks

  return NextResponse.json({
    success: true,
    data: {
      current: healthReport,
      history: healthHistory,
      trends: calculateHealthTrends(healthHistory)
    },
    view: 'health'
  });
}

/**
 * Get performance dashboard data
 */
async function getPerformanceDashboard(timeRange: string) {
  const performanceMetrics = await dataLayerMonitor.getPerformanceMetrics();
  const currentMetrics = metricsCollector.getMetrics();

  // Calculate time range for metrics
  const timeRangeMs = parseTimeRange(timeRange);
  const timeRangeFilter = timeRangeMs ? {
    start: new Date(Date.now() - timeRangeMs),
    end: new Date()
  } : undefined;

  const filteredMetrics = timeRangeFilter 
    ? metricsCollector.getMetrics(timeRangeFilter)
    : currentMetrics;

  return NextResponse.json({
    success: true,
    data: {
      summary: {
        totalOperations: filteredMetrics.totalOperations,
        successRate: filteredMetrics.successRate,
        averageLatency: filteredMetrics.averageDuration,
        errorRate: 100 - filteredMetrics.successRate
      },
      operationBreakdown: filteredMetrics.operationBreakdown,
      recentErrors: filteredMetrics.recentErrors,
      performance: performanceMetrics,
      timeRange: {
        range: timeRange,
        start: timeRangeFilter?.start?.toISOString(),
        end: timeRangeFilter?.end?.toISOString()
      }
    },
    view: 'performance'
  });
}

/**
 * Get migration dashboard data
 */
async function getMigrationDashboard() {
  const migrationMetrics = await dataLayerMonitor.getMigrationMetrics();
  
  // Get migration history (this would be implemented with actual tracking)
  const migrationHistory = [
    {
      timestamp: new Date().toISOString(),
      phase: migrationMetrics.currentPhase,
      status: 'active'
    }
  ];

  return NextResponse.json({
    success: true,
    data: {
      current: migrationMetrics,
      history: migrationHistory,
      recommendations: generateMigrationRecommendations(migrationMetrics)
    },
    view: 'migration'
  });
}

/**
 * Get alerts dashboard
 */
async function getAlertsDashboard() {
  const alerts = dataLayerMonitor.getCurrentAlerts();
  
  // Group alerts by level and service
  const alertsSummary = {
    total: alerts.length,
    byLevel: alerts.reduce((acc, alert) => {
      acc[alert.level] = (acc[alert.level] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    byService: alerts.reduce((acc, alert) => {
      const service = alert.service || 'unknown';
      acc[service] = (acc[service] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    recent: alerts.slice(0, 10) // Most recent 10
  };

  return NextResponse.json({
    success: true,
    data: {
      summary: alertsSummary,
      alerts: alerts,
      suggestions: generateAlertSuggestions(alerts)
    },
    view: 'alerts'
  });
}

/**
 * Clear alerts action
 */
async function clearAlerts(params: { level?: string; service?: string }) {
  const { level, service } = params;

  if (level) {
    dataLayerMonitor.clearAlerts(level as any);
  } else if (service) {
    // This would need to be implemented in the monitor class
    dataLayerMonitor.clearAlerts();
  } else {
    dataLayerMonitor.clearAlerts();
  }

  return NextResponse.json({
    success: true,
    message: 'Alerts cleared successfully'
  });
}

/**
 * Refresh metrics action
 */
async function refreshMetrics() {
  // Clear current metrics and force refresh
  metricsCollector.clearMetrics();
  
  // Perform a health check to regenerate some metrics
  await dataLayerMonitor.performHealthCheck({
    includeDetailedChecks: true
  });

  return NextResponse.json({
    success: true,
    message: 'Metrics refreshed successfully'
  });
}

/**
 * Perform health check action
 */
async function performHealthCheck(params: { detailed?: boolean }) {
  const { detailed = false } = params;

  const healthReport = await dataLayerMonitor.performHealthCheck({
    includeDetailedChecks: detailed,
    includePerformanceMetrics: detailed
  });

  return NextResponse.json({
    success: true,
    data: healthReport,
    message: 'Health check completed successfully'
  });
}

/**
 * Export dashboard data
 */
async function exportDashboardData(params: { format?: string; timeRange?: string }) {
  const { format = 'json', timeRange = '24h' } = params;

  const [healthData, migrationData, performanceData] = await Promise.allSettled([
    dataLayerMonitor.performHealthCheck({ includeDetailedChecks: true }),
    dataLayerMonitor.getMigrationMetrics(),
    dataLayerMonitor.getPerformanceMetrics()
  ]);

  const exportData = {
    timestamp: new Date().toISOString(),
    timeRange,
    health: healthData.status === 'fulfilled' ? healthData.value : null,
    migration: migrationData.status === 'fulfilled' ? migrationData.value : null,
    performance: performanceData.status === 'fulfilled' ? performanceData.value : null,
    alerts: dataLayerMonitor.getCurrentAlerts(),
    metrics: metricsCollector.getMetrics()
  };

  if (format === 'csv') {
    // Convert to CSV format
    const csv = convertToCSV(exportData);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="data-layer-export-${Date.now()}.csv"`
      }
    });
  }

  return NextResponse.json({
    success: true,
    data: exportData,
    format,
    exportedAt: new Date().toISOString()
  });
}

// Utility functions

function calculateHealthTrends(history: any[]) {
  if (history.length < 2) {
    return { trend: 'stable', change: 0 };
  }

  const recent = history.slice(0, 5);
  const older = history.slice(5, 10);

  const recentHealthy = recent.filter(h => h.status === 'healthy').length;
  const olderHealthy = older.filter(h => h.status === 'healthy').length;

  const recentRate = recentHealthy / recent.length;
  const olderRate = older.length > 0 ? olderHealthy / older.length : recentRate;

  const change = recentRate - olderRate;

  return {
    trend: change > 0.1 ? 'improving' : change < -0.1 ? 'declining' : 'stable',
    change: Math.round(change * 100),
    recentHealthRate: Math.round(recentRate * 100)
  };
}

function parseTimeRange(timeRange: string): number | null {
  const ranges = {
    '1h': 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000
  };

  return ranges[timeRange] || null;
}

function generateMigrationRecommendations(migrationMetrics: any) {
  const recommendations: string[] = [];
  
  if (migrationMetrics.dataConsistency.inconsistencyRate > 5) {
    recommendations.push('High inconsistency rate detected. Consider investigating data synchronization issues.');
  }

  if (migrationMetrics.dualWriteMetrics.averageLatency > 1000) {
    recommendations.push('High dual-write latency. Consider optimizing database connections or enabling async writes.');
  }

  if (migrationMetrics.currentPhase === 'dual_write_firestore_primary') {
    recommendations.push('Consider moving to validation phase once consistency issues are resolved.');
  }

  return recommendations;
}

function generateAlertSuggestions(alerts: any[]) {
  const suggestions: string[] = [];
  
  const criticalAlerts = alerts.filter(a => a.level === 'critical');
  if (criticalAlerts.length > 0) {
    suggestions.push(`Address ${criticalAlerts.length} critical alerts immediately.`);
  }

  const performanceAlerts = alerts.filter(a => a.service === 'performance');
  if (performanceAlerts.length > 2) {
    suggestions.push('Multiple performance alerts detected. Consider scaling resources or optimizing queries.');
  }

  const consistencyAlerts = alerts.filter(a => a.service === 'data-consistency');
  if (consistencyAlerts.length > 0) {
    suggestions.push('Data consistency issues detected. Review dual-write configuration and validate data synchronization.');
  }

  return suggestions;
}

function convertToCSV(data: any): string {
  // Simple CSV conversion for basic metrics
  const lines = [
    'Timestamp,Metric,Value,Service',
    `${data.timestamp},Total Operations,${data.metrics?.totalOperations || 0},overall`,
    `${data.timestamp},Success Rate,${data.metrics?.successRate || 0},overall`,
    `${data.timestamp},Average Latency,${data.metrics?.averageDuration || 0},overall`,
    `${data.timestamp},Health Status,${data.health?.overall || 'unknown'},health`
  ];

  // Add alert data
  data.alerts?.forEach((alert: any) => {
    lines.push(`${alert.timestamp},Alert,${alert.level},${alert.service || 'unknown'}`);
  });

  return lines.join('\n');
}