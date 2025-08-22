import { NextResponse } from 'next/server';
import { firebaseUserService } from '@/lib/services/firebase-user-service';

export async function GET() {
  try {
    console.log('🏥 Firebase health check requested');
    
    // Perform comprehensive health check
    const healthResult = await firebaseUserService.healthCheck();
    
    const response = {
      service: 'firebase',
      timestamp: new Date().toISOString(),
      status: healthResult.healthy ? 'healthy' : 'unhealthy',
      details: healthResult.details
    };
    
    console.log('🏥 Firebase health check result:', response);
    
    return NextResponse.json(response, {
      status: healthResult.healthy ? 200 : 503,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });
    
  } catch (error) {
    console.error('❌ Firebase health check failed:', error);
    
    return NextResponse.json({
      service: 'firebase',
      timestamp: new Date().toISOString(),
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      details: {
        firebaseAuth: 'error',
        firestore: 'error'
      }
    }, {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });
  }
}
