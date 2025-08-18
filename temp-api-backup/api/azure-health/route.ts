import { NextResponse } from 'next/server';
import { getAzureHealthStatus } from '@/lib/azure-startup';

export async function GET() {
  try {
    const healthStatus = getAzureHealthStatus();
    
    return NextResponse.json({
      status: 'Azure Health Check',
      overall: healthStatus.overall,
      services: healthStatus.services,
      keyVault: healthStatus.keyVault,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Azure health check failed:', error);
    
    return NextResponse.json({
      status: 'Azure Health Check Failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
