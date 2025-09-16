import { NextRequest, NextResponse } from 'next/server';
import { firebaseUserService } from '@/lib/services/firebase-user-service';

export async function GET(request: NextRequest) {
  const timestamp = new Date().toISOString();
  console.log(`🏥 [${timestamp}] Auth health check requested`);
  
  try {
    const healthResult = await firebaseUserService.healthCheck();
    
    console.log(`🏥 [${timestamp}] Auth health check result:`, healthResult);
    
    return NextResponse.json({
      status: healthResult.healthy ? 'healthy' : 'unhealthy',
      timestamp,
      checks: {
        firebaseAuth: healthResult.details.firebaseAuth,
        firestore: healthResult.details.firestore,
      },
      services: {
        name: 'PrepBettr Auth System',
        version: '1.0.0'
      }
    }, { 
      status: healthResult.healthy ? 200 : 503 
    });
    
  } catch (error) {
    console.error(`🏥 [${timestamp}] Auth health check failed:`, error);
    
    return NextResponse.json({
      status: 'error',
      timestamp,
      error: error instanceof Error ? error.message : 'Unknown error',
      checks: {
        firebaseAuth: 'error',
        firestore: 'error'
      }
    }, { status: 500 });
  }
}