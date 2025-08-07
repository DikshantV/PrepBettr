import { NextRequest, NextResponse } from 'next/server';
import { getAzureTokenService } from '../../../lib/services/azure-token-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { portal, clientId, clientSecret, tenantId, redirectUri, scopes } = body;
    
    if (!portal || !clientId || !clientSecret || !redirectUri || !scopes) {
      return NextResponse.json(
        { error: 'All fields are required: portal, clientId, clientSecret, redirectUri, scopes' },
        { status: 400 }
      );
    }
    
    if (!['linkedin', 'wellfound'].includes(portal)) {
      return NextResponse.json(
        { error: 'Invalid portal. Supported: linkedin, wellfound' },
        { status: 400 }
      );
    }
    
    const tokenService = getAzureTokenService();
    
    const config = {
      clientId,
      clientSecret,
      tenantId: tenantId || 'common',
      redirectUri,
      scopes: Array.isArray(scopes) ? scopes : [scopes],
    };
    
    try {
      await tokenService.storeAzureADConfig(portal as 'linkedin' | 'wellfound', config);
      
      return NextResponse.json({
        success: true,
        message: `Successfully configured ${portal} OAuth settings`,
      });
    } catch (error) {
      console.error(`Error storing ${portal} configuration:`, error);
      return NextResponse.json(
        { error: 'Failed to store configuration in Azure Key Vault' },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error('Portal config POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const portal = searchParams.get('portal');
    
    if (!portal) {
      return NextResponse.json(
        { error: 'Portal parameter is required' },
        { status: 400 }
      );
    }
    
    if (!['linkedin', 'wellfound'].includes(portal)) {
      return NextResponse.json(
        { error: 'Invalid portal. Supported: linkedin, wellfound' },
        { status: 400 }
      );
    }
    
    const tokenService = getAzureTokenService();
    
    try {
      const config = await tokenService.getAzureADConfig(portal as 'linkedin' | 'wellfound');
      
      if (!config) {
        return NextResponse.json(
          { error: `No configuration found for ${portal}` },
          { status: 404 }
        );
      }
      
      // Return config without sensitive information
      return NextResponse.json({
        portal,
        clientId: config.clientId,
        tenantId: config.tenantId,
        redirectUri: config.redirectUri,
        scopes: config.scopes,
        // Don't return clientSecret for security
      });
    } catch (error) {
      console.error(`Error retrieving ${portal} configuration:`, error);
      return NextResponse.json(
        { error: 'Failed to retrieve configuration from Azure Key Vault' },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error('Portal config GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
