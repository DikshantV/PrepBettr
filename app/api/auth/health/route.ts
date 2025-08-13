import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware, createHealthCheckResponse, optionalAuth } from '@/lib/middleware/authMiddleware';
import { azureFunctionsClient } from '@/lib/services/azure-functions-client';

/**
 * Authentication System Health Check
 * 
 * GET /api/auth/health - Public health check
 * POST /api/auth/health - Protected health check with token validation
 */

export async function GET() {
  try {
    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'Firebase Authentication System',
      components: {
        'firebase-admin': 'unknown',
        'azure-functions': 'unknown',
        'middleware': 'healthy'
      }
    };

    // Test Azure Functions connectivity
    try {
      const azureHealth = await azureFunctionsClient.healthCheck();
      healthData.components['azure-functions'] = azureHealth.status || 'unhealthy';
    } catch (error) {
      healthData.components['azure-functions'] = 'unhealthy';
    }

    // Test Firebase Admin SDK
    try {
      const { auth } = await import('@/firebase/admin');
      // Try to list users (limit 1 to minimize impact)
      await auth.listUsers(1);
      healthData.components['firebase-admin'] = 'healthy';
    } catch (error) {
      console.warn('Firebase Admin SDK health check failed:', error);
      healthData.components['firebase-admin'] = 'unhealthy';
    }

    // Overall status
    const allHealthy = Object.values(healthData.components).every(status => status === 'healthy');
    healthData.status = allHealthy ? 'healthy' : 'degraded';

    return NextResponse.json(healthData, { 
      status: allHealthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });

  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  }
}

/**
 * Protected health check - validates authentication middleware
 */
export async function POST(request: NextRequest) {
  try {
    // Test authentication middleware
    const authResult = await authMiddleware(request);
    
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({
        status: 'auth-failed',
        timestamp: new Date().toISOString(),
        error: 'Authentication test failed',
        message: 'Please provide a valid Bearer token in Authorization header'
      }, { status: 401 });
    }

    const user = authResult.user;

    // Run additional authenticated health checks
    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'Authenticated Firebase System',
      authenticatedUser: {
        uid: user.uid,
        email: user.email,
        emailVerified: user.email_verified
      },
      tests: {
        'token-verification': 'passed',
        'user-data-access': 'unknown',
        'azure-functions-auth': 'unknown'
      }
    };

    // Test user data access
    try {
      const { db } = await import('@/firebase/admin');
      const userDoc = await db.collection('users').doc(user.uid).get();
      healthData.tests['user-data-access'] = userDoc.exists ? 'passed' : 'no-data';
    } catch (error) {
      console.warn('User data access test failed:', error);
      healthData.tests['user-data-access'] = 'failed';
    }

    // Test Azure Functions with authentication
    try {
      const token = request.headers.get('authorization')?.replace('Bearer ', '');
      if (token) {
        const azureVerifyResult = await azureFunctionsClient.verifyToken(token);
        healthData.tests['azure-functions-auth'] = azureVerifyResult.valid ? 'passed' : 'failed';
      }
    } catch (error) {
      console.warn('Azure Functions auth test failed:', error);
      healthData.tests['azure-functions-auth'] = 'failed';
    }

    // Overall status
    const allPassed = Object.values(healthData.tests).every(test => test === 'passed' || test === 'no-data');
    healthData.status = allPassed ? 'healthy' : 'degraded';

    return NextResponse.json(healthData, {
      status: allPassed ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });

  } catch (error) {
    console.error('Protected health check error:', error);
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Protected health check failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  }
}
