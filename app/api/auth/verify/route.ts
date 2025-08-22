import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/middleware/authMiddleware';

export async function GET(request: NextRequest) {
  console.log(`🔍 [${new Date().toISOString()}] AUTH VERIFY GET called - User-Agent: ${request.headers.get('user-agent')?.substring(0, 50)}`);
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const authResult = await verifyFirebaseToken(token);
    
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      user: authResult.user
    });

  } catch (error) {
    console.error('Token verification error:', error);
    return NextResponse.json(
      { error: 'Token verification failed' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Support both GET and POST for flexibility
  return GET(request);
}
