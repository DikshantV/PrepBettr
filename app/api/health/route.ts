import { NextResponse } from 'next/server';

interface HealthStatus {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  details?: any;
}

interface OverallHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  services: {
    [key: string]: HealthStatus;
  };
  summary: {
    total: number;
    healthy: number;
    unhealthy: number;
    degraded: number;
  };
}

async function checkFirebaseHealth(): Promise<HealthStatus> {
  try {
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/health/firebase`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      return {
        service: 'firebase',
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        details: { error: `HTTP ${response.status}` }
      };
    }
    
    const data = await response.json();
    return {
      service: 'firebase',
      status: data.status === 'healthy' ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      details: data.details
    };
  } catch (error) {
    return {
      service: 'firebase',
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    };
  }
}

async function checkDatabaseHealth(): Promise<HealthStatus> {
  // For now, return healthy - can be expanded to check actual database connections
  return {
    service: 'database',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    details: { note: 'Basic health check - no database connectivity test implemented' }
  };
}

async function checkSystemHealth(): Promise<HealthStatus> {
  const memoryUsage = process.memoryUsage();
  const uptime = process.uptime();
  
  // Simple memory health check - consider degraded if using > 80% of heap
  const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
  const status = memoryUsagePercent > 80 ? 'degraded' : 'healthy';
  
  return {
    service: 'system',
    status,
    timestamp: new Date().toISOString(),
    details: {
      uptime: Math.round(uptime),
      memory: {
        used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        percentage: Math.round(memoryUsagePercent),
        unit: 'MB'
      }
    }
  };
}

export async function GET() {
  try {
    console.log('🏥 General health check requested');
    
    // Check all services in parallel
    const [firebaseHealth, databaseHealth, systemHealth] = await Promise.all([
      checkFirebaseHealth(),
      checkDatabaseHealth(),
      checkSystemHealth()
    ]);
    
    const services = {
      firebase: firebaseHealth,
      database: databaseHealth,
      system: systemHealth
    };
    
    // Calculate summary
    const serviceStatuses = Object.values(services);
    const summary = {
      total: serviceStatuses.length,
      healthy: serviceStatuses.filter(s => s.status === 'healthy').length,
      unhealthy: serviceStatuses.filter(s => s.status === 'unhealthy').length,
      degraded: serviceStatuses.filter(s => s.status === 'degraded').length
    };
    
    // Determine overall status
    let overallStatus: 'healthy' | 'unhealthy' | 'degraded';
    if (summary.unhealthy > 0) {
      overallStatus = 'unhealthy';
    } else if (summary.degraded > 0) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }
    
    const response: OverallHealth = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services,
      summary
    };
    
    console.log('🏥 General health check result:', { status: overallStatus, summary });
    
    // Return appropriate HTTP status
    const httpStatus = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'degraded' ? 200 : 503;
    
    return NextResponse.json(response, {
      status: httpStatus,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });
    
  } catch (error) {
    console.error('❌ General health check failed:', error);
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {},
      summary: { total: 0, healthy: 0, unhealthy: 1, degraded: 0 },
      error: error instanceof Error ? error.message : 'Unknown error'
    }, {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });
  }
}
