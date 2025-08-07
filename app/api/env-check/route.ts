import { NextResponse } from 'next/server';
import { getAzureHealthStatus } from '@/lib/azure-startup';

export async function GET() {
  const envCheck = {
    NODE_ENV: process.env.NODE_ENV,
    VERCEL: !!process.env.VERCEL ? 'YES' : 'NO',
    // Azure environment variables
    AZURE_KEY_VAULT_URI: !!process.env.AZURE_KEY_VAULT_URI ? 'SET' : 'MISSING',
    NEXT_PUBLIC_SPEECH_KEY: !!process.env.NEXT_PUBLIC_SPEECH_KEY ? 'SET' : 'MISSING',
    NEXT_PUBLIC_SPEECH_ENDPOINT: !!process.env.NEXT_PUBLIC_SPEECH_ENDPOINT ? 'SET' : 'MISSING',
    AZURE_OPENAI_KEY: !!process.env.AZURE_OPENAI_KEY ? 'SET' : 'MISSING',
    AZURE_OPENAI_ENDPOINT: !!process.env.AZURE_OPENAI_ENDPOINT ? 'SET' : 'MISSING',
    AZURE_OPENAI_DEPLOYMENT: !!process.env.AZURE_OPENAI_DEPLOYMENT ? 'SET' : 'MISSING',
    NEXT_PUBLIC_APP_INSIGHTS_INSTRUMENTATION_KEY: !!process.env.NEXT_PUBLIC_APP_INSIGHTS_INSTRUMENTATION_KEY ? 'SET' : 'MISSING'
  };

  // Get Azure health status
  const azureHealth = getAzureHealthStatus();

  return NextResponse.json({
    status: 'Environment check',
    environment: envCheck,
    azure: azureHealth,
    timestamp: new Date().toISOString()
  });
}
