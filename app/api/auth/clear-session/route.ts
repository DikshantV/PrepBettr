import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    
    // Clear the session cookie
    cookieStore.delete('session');
    
    console.log('🧹 Session cookie cleared');
    
    return NextResponse.json({
      success: true,
      message: 'Session cleared successfully'
    });
  } catch (error) {
    console.error('❌ Failed to clear session:', error);
    return NextResponse.json(
      { error: 'Failed to clear session' },
      { status: 500 }
    );
  }
}