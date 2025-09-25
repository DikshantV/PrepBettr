import { NextRequest, NextResponse } from 'next/server';

/**
 * Debug endpoint for Firebase Admin SDK configuration diagnostics
 * WARNING: This endpoint exposes sensitive configuration information and should be protected
 */
export async function GET(request: NextRequest) {
  // Basic security check - only allow in development or with specific header
  const isDevelopment = process.env.NODE_ENV === 'development';
  const debugHeader = request.headers.get('x-debug-auth');
  const allowedDebugToken = process.env.DEBUG_AUTH_TOKEN || 'debug-firebase-2024';

  if (!isDevelopment && debugHeader !== allowedDebugToken) {
    return NextResponse.json(
      { error: 'Unauthorized - Debug endpoint requires authorization' },
      { status: 401 }
    );
  }

  try {
    console.log('🔍 Debug endpoint: Firebase config diagnostics requested');
    
    // Environment variables check
    const envCheck = {
      hasServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
      hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
      hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
      projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'not set',
      privateKeyLength: process.env.FIREBASE_PRIVATE_KEY?.length || 0,
      privateKeyFormat: process.env.FIREBASE_PRIVATE_KEY?.includes('-----BEGIN PRIVATE KEY-----') ? 'PEM' : 'unknown',
      privateKeyHasNewlines: process.env.FIREBASE_PRIVATE_KEY?.includes('\n') || false,
      privateKeyHasEscapedNewlines: process.env.FIREBASE_PRIVATE_KEY?.includes('\\n') || false,
      nodeEnv: process.env.NODE_ENV,
      azureKeyVaultUri: process.env.AZURE_KEY_VAULT_URI || 'not set'
    };

    // Test Firebase Admin SDK initialization
    let firebaseStatus = {
      adminSDKAvailable: false,
      adminAppInitialized: false,
      adminAuthAvailable: false,
      connectivityTest: 'not attempted',
      initializationError: null as string | null
    };

    try {
      // Import Firebase admin dynamically
      const { getAdminAuth } = await import('@/lib/firebase/admin');
      firebaseStatus.adminSDKAvailable = true;

      // Test getting auth instance
      const auth = await getAdminAuth();
      firebaseStatus.adminAppInitialized = true;
      firebaseStatus.adminAuthAvailable = !!auth;

      // Test connectivity with a lightweight operation
      try {
        await auth.getUser('test-connectivity-' + Date.now());
        firebaseStatus.connectivityTest = 'connection_ok';
      } catch (testError: any) {
        if (testError.code === 'auth/user-not-found') {
          firebaseStatus.connectivityTest = 'connection_ok_user_not_found_as_expected';
        } else {
          firebaseStatus.connectivityTest = `error: ${testError.code || testError.message}`;
        }
      }
    } catch (error) {
      firebaseStatus.initializationError = error instanceof Error ? error.message : 'Unknown error';
    }

    // Test unified auth system
    let unifiedAuthStatus = {
      available: false,
      initialized: false,
      healthCheck: null as any,
      error: null as string | null
    };

    try {
      const { getUnifiedAuth } = await import('@/lib/shared/auth/core');
      const auth = getUnifiedAuth();
      unifiedAuthStatus.available = true;

      await auth.initialize();
      unifiedAuthStatus.initialized = true;

      const health = await auth.healthCheck();
      unifiedAuthStatus.healthCheck = health;
    } catch (error) {
      unifiedAuthStatus.error = error instanceof Error ? error.message : 'Unknown error';
    }

    // Test Azure Key Vault configuration
    let azureConfigStatus = {
      available: false,
      configLoaded: false,
      firebaseSecretsFromAzure: false,
      error: null as string | null
    };

    try {
      const { getConfiguration } = await import('@/lib/azure-config');
      azureConfigStatus.available = true;

      const config = await getConfiguration();
      azureConfigStatus.configLoaded = true;
      azureConfigStatus.firebaseSecretsFromAzure = !!(
        config['FIREBASE_PROJECT_ID'] && 
        config['FIREBASE_CLIENT_EMAIL'] && 
        config['FIREBASE_PRIVATE_KEY']
      );
    } catch (error) {
      azureConfigStatus.error = error instanceof Error ? error.message : 'Unknown error';
    }

    const diagnosticResult = {
      timestamp: new Date().toISOString(),
      environment: envCheck,
      firebaseAdmin: firebaseStatus,
      unifiedAuth: unifiedAuthStatus,
      azureConfig: azureConfigStatus,
      summary: {
        criticalIssues: [] as string[],
        warnings: [] as string[]
      }
    };

    // Analyze issues
    if (!envCheck.hasPrivateKey && !azureConfigStatus.firebaseSecretsFromAzure) {
      diagnosticResult.summary.criticalIssues.push('No Firebase private key found in environment or Azure Key Vault');
    }
    
    if (!envCheck.hasClientEmail && !azureConfigStatus.firebaseSecretsFromAzure) {
      diagnosticResult.summary.criticalIssues.push('No Firebase client email found in environment or Azure Key Vault');
    }
    
    if (envCheck.privateKeyFormat !== 'PEM') {
      diagnosticResult.summary.criticalIssues.push('Firebase private key does not appear to be in PEM format');
    }
    
    if (envCheck.privateKeyHasEscapedNewlines) {
      diagnosticResult.summary.warnings.push('Firebase private key contains escaped newlines (\\n) - may need unescaping');
    }
    
    if (firebaseStatus.initializationError) {
      diagnosticResult.summary.criticalIssues.push(`Firebase Admin SDK initialization failed: ${firebaseStatus.initializationError}`);
    }
    
    if (unifiedAuthStatus.error) {
      diagnosticResult.summary.criticalIssues.push(`Unified Auth system error: ${unifiedAuthStatus.error}`);
    }

    return NextResponse.json(diagnosticResult, { 
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('🔍 Debug endpoint error:', error);
    return NextResponse.json(
      { 
        error: 'Debug endpoint failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}