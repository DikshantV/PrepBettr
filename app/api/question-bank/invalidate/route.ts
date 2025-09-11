/**
 * Question Bank Cache Invalidation API
 * 
 * Provides manual cache invalidation for the question bank service.
 * Useful for development, testing, and operational maintenance.
 */

import { NextRequest, NextResponse } from 'next/server';
import { questionBankService } from '@/lib/services/question-bank-service';
import { logServerError } from '@/lib/errors';

// Supported HTTP methods
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pattern, reason } = body;

    // Validate admin access (basic implementation)
    const authHeader = request.headers.get('authorization');
    if (!isAuthorizedForCacheOps(authHeader)) {
      return NextResponse.json(
        { error: 'Unauthorized - admin access required' },
        { status: 401 }
      );
    }

    // Invalidate cache
    questionBankService.invalidateCache(pattern);

    // Get current cache stats
    const stats = questionBankService.getCacheStats();

    // Log the cache invalidation
    console.log('🔄 Question bank cache invalidated', {
      pattern: pattern || 'all',
      reason: reason || 'manual-request',
      timestamp: new Date().toISOString(),
      remainingSize: stats.size
    });

    return NextResponse.json({
      success: true,
      message: pattern 
        ? `Cache invalidated for pattern: ${pattern}`
        : 'Entire question bank cache invalidated',
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error invalidating question bank cache:', error);
    
    logServerError(error as Error, {
      service: 'question-bank-api',
      action: 'invalidate-cache'
    });

    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Cache invalidation failed'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Basic auth check for stats access
    const authHeader = request.headers.get('authorization');
    if (!isAuthorizedForCacheOps(authHeader)) {
      return NextResponse.json(
        { error: 'Unauthorized - admin access required' },
        { status: 401 }
      );
    }

    // Get cache statistics
    const stats = questionBankService.getCacheStats();

    return NextResponse.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error getting question bank cache stats:', error);
    
    logServerError(error as Error, {
      service: 'question-bank-api',
      action: 'get-cache-stats'
    });

    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get cache stats'
      },
      { status: 500 }
    );
  }
}

/**
 * Basic authorization check for cache operations
 * In production, this should integrate with proper admin authentication
 */
function isAuthorizedForCacheOps(authHeader: string | null): boolean {
  // For development: allow cache invalidation without auth
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  // For production: check for admin key or proper auth token
  if (!authHeader) {
    return false;
  }

  // Check for admin API key
  const adminKey = process.env.ADMIN_API_KEY;
  if (adminKey && authHeader === `Bearer ${adminKey}`) {
    return true;
  }

  // In a full implementation, you would:
  // 1. Verify JWT tokens
  // 2. Check user roles/permissions
  // 3. Validate against your auth system
  
  return false;
}

// Health check for the invalidation endpoint
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
