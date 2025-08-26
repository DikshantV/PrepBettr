import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/middleware/authMiddleware';

export async function GET(request: NextRequest) {
  const timestamp = new Date().toISOString();
  console.log(`🔍 [${timestamp}] AUTH VERIFY GET called - User-Agent: ${request.headers.get('user-agent')?.substring(0, 50)}`);
  try {
    const authHeader = request.headers.get('authorization');
    
    console.log(`🔍 [${timestamp}] Authorization header check:`, {
      hasAuthHeader: !!authHeader,
      startsWithBearer: authHeader?.startsWith('Bearer ') || false,
      headerPreview: authHeader ? authHeader.substring(0, 20) + '...' : 'none'
    });
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error(`🔍 [${timestamp}] Missing or invalid authorization header`);
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    console.log(`🔍 [${timestamp}] Token details:`, {
      tokenLength: token.length,
      tokenParts: token.split('.').length,
      tokenPrefix: token.substring(0, 50) + '...',
      isJWT: token.includes('.')
    });
    
    console.log(`🔍 [${timestamp}] Calling verifyFirebaseToken...`);
    const authResult = await verifyFirebaseToken(token);
    
    console.log(`🔍 [${timestamp}] Firebase token verification result:`, {
      success: authResult.success,
      hasUser: !!authResult.user,
      uid: authResult.user?.uid,
      email: authResult.user?.email,
      error: authResult.error
    });
    
    if (!authResult.success || !authResult.user) {
      console.error(`🔍 [${timestamp}] Token verification failed:`, {
        success: authResult.success,
        hasUser: !!authResult.user,
        error: authResult.error
      });
      return NextResponse.json(
        { error: `Invalid or expired token: ${authResult.error}` },
        { status: 401 }
      );
    }

    console.log(`🔍 [${timestamp}] Token verification successful for uid: ${authResult.user.uid}`);
    return NextResponse.json({
      success: true,
      user: authResult.user
    });

  } catch (error) {
    console.error(`🔍 [${timestamp}] Token verification error:`, error);
    return NextResponse.json(
      { error: `Token verification failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Support both GET and POST for flexibility
  return GET(request);
}
