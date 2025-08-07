import { NextRequest, NextResponse } from 'next/server';
import { getLinkedInPortal } from '../../../../portals/linkedin';
import { getWellfoundPortal } from '../../../../portals/wellfound';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const portal = searchParams.get('portal'); // Should be passed as a query parameter
    
    // Handle OAuth errors
    if (error) {
      console.error(`OAuth error for ${portal}:`, error);
      return NextResponse.redirect(`/dashboard/auto-apply?error=${encodeURIComponent(error)}`);
    }
    
    if (!code || !state || !portal) {
      return NextResponse.redirect('/dashboard/auto-apply?error=missing_parameters');
    }
    
    if (!['linkedin', 'wellfound'].includes(portal)) {
      return NextResponse.redirect('/dashboard/auto-apply?error=invalid_portal');
    }
    
    const userId = state; // We use userId as state
    
    try {
      let success = false;
      
      if (portal === 'linkedin') {
        const linkedinPortal = getLinkedInPortal();
        await linkedinPortal.initialize();
        success = await linkedinPortal.exchangeCodeForTokens(code, userId);
      } else if (portal === 'wellfound') {
        const wellfoundPortal = getWellfoundPortal();
        await wellfoundPortal.initialize();
        success = await wellfoundPortal.exchangeCodeForTokens(code, userId);
      }
      
      if (success) {
        return NextResponse.redirect(`/dashboard/auto-apply?connected=${portal}`);
      } else {
        return NextResponse.redirect(`/dashboard/auto-apply?error=token_exchange_failed`);
      }
      
    } catch (error) {
      console.error(`Error processing OAuth callback for ${portal}:`, error);
      return NextResponse.redirect(`/dashboard/auto-apply?error=callback_processing_failed`);
    }
    
  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect('/dashboard/auto-apply?error=internal_server_error');
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, portal, userId } = body;
    
    if (!code || !portal || !userId) {
      return NextResponse.json(
        { error: 'Code, portal, and userId are required' },
        { status: 400 }
      );
    }
    
    if (!['linkedin', 'wellfound'].includes(portal)) {
      return NextResponse.json(
        { error: 'Invalid portal. Supported: linkedin, wellfound' },
        { status: 400 }
      );
    }
    
    try {
      let success = false;
      let profile = null;
      
      if (portal === 'linkedin') {
        const linkedinPortal = getLinkedInPortal();
        await linkedinPortal.initialize();
        success = await linkedinPortal.exchangeCodeForTokens(code, userId);
        if (success) {
          profile = await linkedinPortal.getProfile(userId);
        }
      } else if (portal === 'wellfound') {
        const wellfoundPortal = getWellfoundPortal();
        await wellfoundPortal.initialize();
        success = await wellfoundPortal.exchangeCodeForTokens(code, userId);
        if (success) {
          profile = await wellfoundPortal.getProfile(userId);
        }
      }
      
      if (success) {
        return NextResponse.json({
          success: true,
          message: `Successfully connected to ${portal}`,
          profile
        });
      } else {
        return NextResponse.json(
          { error: 'Failed to exchange authorization code for tokens' },
          { status: 400 }
        );
      }
      
    } catch (error) {
      console.error(`Error processing OAuth callback for ${portal}:`, error);
      return NextResponse.json(
        { error: 'Failed to process OAuth callback' },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error('OAuth callback POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
