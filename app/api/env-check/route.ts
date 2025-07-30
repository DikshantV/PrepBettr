import { NextResponse } from 'next/server';

export async function GET() {
  const envCheck = {
    GOOGLE_GENERATIVE_AI_API_KEY: !!process.env.GOOGLE_GENERATIVE_AI_API_KEY ? 'SET' : 'MISSING',
    VAPI_WEBHOOK_SECRET: !!process.env.VAPI_WEBHOOK_SECRET ? 'SET' : 'MISSING',
    GOOGLE_GENERATIVE_AI_API_KEY_LENGTH: process.env.GOOGLE_GENERATIVE_AI_API_KEY?.length || 0,
    VAPI_WEBHOOK_SECRET_LENGTH: process.env.VAPI_WEBHOOK_SECRET?.length || 0,
    NODE_ENV: process.env.NODE_ENV,
    VERCEL: !!process.env.VERCEL ? 'YES' : 'NO'
  };

  return NextResponse.json({
    status: 'Environment check',
    environment: envCheck,
    timestamp: new Date().toISOString()
  });
}
