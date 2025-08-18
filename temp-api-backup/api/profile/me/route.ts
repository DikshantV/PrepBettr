import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedUser } from '@/lib/middleware/authMiddleware';
import { getCurrentUser } from '@/lib/actions/auth.action';

export const GET = withAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    // Get full user profile data
    const userProfile = await getCurrentUser();
    
    if (!userProfile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }
    
    // Ensure the profile matches the authenticated user
    if (userProfile.id !== user.uid) {
      return NextResponse.json(
        { error: 'Profile access denied' },
        { status: 403 }
      );
    }
    
    return NextResponse.json({
      success: true,
      user: userProfile,
      authenticatedAs: user.uid
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user profile' },
      { status: 500 }
    );
  }
});
