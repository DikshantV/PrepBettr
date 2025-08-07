import { NextRequest, NextResponse } from 'next/server';
import { getLinkedInPortal } from '../../../../portals/linkedin';
import { getWellfoundPortal } from '../../../../portals/wellfound';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const portal = searchParams.get('portal');
    const userId = searchParams.get('userId');
    const state = searchParams.get('state');
    
    if (!portal || !userId) {
      return NextResponse.json(
        { error: 'Portal and userId are required' },
        { status: 400 }
      );
    }
    
    if (!['linkedin', 'wellfound'].includes(portal)) {
      return NextResponse.json(
        { error: 'Invalid portal. Supported: linkedin, wellfound' },
        { status: 400 }
      );
    }
    
    let authUrl: string;
    
    try {
      if (portal === 'linkedin') {
        const linkedinPortal = getLinkedInPortal();
        await linkedinPortal.initialize();
        authUrl = linkedinPortal.generateAuthUrl(userId, state);
      } else if (portal === 'wellfound') {
        const wellfoundPortal = getWellfoundPortal();
        await wellfoundPortal.initialize();
        authUrl = wellfoundPortal.generateAuthUrl(userId, state);
      } else {
        throw new Error('Unsupported portal');
      }
    } catch (error) {
      console.error(`Error initializing ${portal} portal:`, error);
      return NextResponse.json(
        { error: `Failed to initialize ${portal} portal. Please check configuration.` },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ authUrl });
    
  } catch (error) {
    console.error('OAuth authorize error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
