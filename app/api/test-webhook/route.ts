import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ 
    status: 'working',
    timestamp: new Date().toISOString(),
    message: 'Test webhook endpoint is active'
  });
}

export async function POST() {
  return NextResponse.json({ 
    status: 'POST working',
    timestamp: new Date().toISOString() 
  });
}
