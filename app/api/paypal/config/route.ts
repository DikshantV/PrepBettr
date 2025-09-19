import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
    const paypalClientSecret = process.env.PAYPAL_CLIENT_SECRET;
    const paypalMode = process.env.PAYPAL_MODE || 'sandbox';

    // Basic validation
    const isConfigured = !!(paypalClientId && paypalClientSecret);
    const isValidClientId = paypalClientId && paypalClientId.length >= 60; // PayPal client IDs are typically ~80 chars
    
    const config = {
      hasClientId: !!paypalClientId,
      hasClientSecret: !!paypalClientSecret,
      clientIdLength: paypalClientId?.length || 0,
      mode: paypalMode,
      environment: process.env.NODE_ENV,
      isConfigured,
      isValidClientId,
      sdkOptions: {
        currency: 'USD',
        intent: 'subscription',
        vault: true,
        components: 'buttons'
      }
    };

    // Only include sensitive data in development
    const responseData = {
      success: true,
      config,
      timestamp: new Date().toISOString(),
      ...(process.env.NODE_ENV === 'development' && {
        debug: {
          clientIdPreview: paypalClientId?.substring(0, 10) + '...',
          allPaypalEnvVars: Object.keys(process.env)
            .filter(key => key.toLowerCase().includes('paypal'))
            .map(key => ({ key, hasValue: !!process.env[key] }))
        }
      })
    };

    // Cache configuration for better performance
    const headers = {
      'Cache-Control': 'private, max-age=3600', // 1 hour cache
      'Content-Type': 'application/json'
    };

    return NextResponse.json(responseData, { headers });

  } catch (error) {
    console.error('PayPal config API error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Configuration error',
        message: process.env.NODE_ENV === 'development' 
          ? (error as Error).message 
          : 'Unable to load PayPal configuration',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// OPTIONS for CORS preflight
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}