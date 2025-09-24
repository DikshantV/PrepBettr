import { NextResponse } from 'next/server';

export async function GET() {
  const timestamp = new Date().toISOString();
  console.log(`🔍 [${timestamp}] Firebase Admin SDK Diagnostic Check`);
  
  const result: any = {
    timestamp,
    environment: process.env.NODE_ENV,
    checks: {}
  };

  try {
    // Check if running on client side
    if (typeof window !== 'undefined') {
      return NextResponse.json({
        ...result,
        error: 'Cannot run Firebase Admin SDK diagnostic on client side'
      }, { status: 400 });
    }

    // Check environment variables
    result.checks.environment = {
      FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID ? 'present' : 'missing',
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? 'present' : 'missing',
      FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL ? 'present' : 'missing',
      FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY ? `present (${process.env.FIREBASE_PRIVATE_KEY.length} chars)` : 'missing',
      FIREBASE_PRIVATE_KEY_DIRECT: process.env.FIREBASE_PRIVATE_KEY_DIRECT ? `present (${process.env.FIREBASE_PRIVATE_KEY_DIRECT.length} chars)` : 'missing',
    };

    // Check Azure configuration
    try {
      const { getConfiguration } = await import('@/lib/azure-config');
      const azureConfig = await getConfiguration();
      
      result.checks.azureConfig = {
        hasConfig: !!azureConfig,
        FIREBASE_PROJECT_ID: azureConfig['FIREBASE_PROJECT_ID'] ? 'present' : 'missing',
        FIREBASE_CLIENT_EMAIL: azureConfig['FIREBASE_CLIENT_EMAIL'] ? 'present' : 'missing',
        FIREBASE_PRIVATE_KEY: azureConfig['FIREBASE_PRIVATE_KEY'] ? `present (${azureConfig['FIREBASE_PRIVATE_KEY'].length} chars)` : 'missing',
      };
    } catch (azureError) {
      result.checks.azureConfig = {
        error: azureError instanceof Error ? azureError.message : 'Failed to load Azure config'
      };
    }

    // Check Firebase Admin SDK initialization
    try {
      console.log(`🔍 [${timestamp}] Attempting Firebase Admin SDK import...`);
      const adminModule = await import('@/lib/firebase/admin');
      result.checks.adminModule = 'imported successfully';

      console.log(`🔍 [${timestamp}] Attempting Firebase Admin initialization...`);
      
      // Try to get the admin auth instance (this will trigger initialization)
      const adminAuth = await adminModule.getAdminAuth();
      result.checks.adminAuth = adminAuth ? 'initialized' : 'failed to initialize';

      // Try a simple operation
      try {
        await adminAuth.getUser('test-diagnostic-user-' + Date.now());
      } catch (testError: any) {
        if (testError.code === 'auth/user-not-found') {
          result.checks.connectivityTest = 'passed (user-not-found expected)';
        } else {
          result.checks.connectivityTest = {
            status: 'failed',
            error: testError.message,
            code: testError.code
          };
        }
      }

    } catch (adminError) {
      result.checks.adminSDK = {
        status: 'failed',
        error: adminError instanceof Error ? adminError.message : 'Unknown error'
      };
      console.error(`🔍 [${timestamp}] Firebase Admin SDK diagnostic error:`, adminError);
    }

    // Check Firebase apps
    try {
      const admin = await import('firebase-admin');
      result.checks.firebaseApps = {
        count: admin.apps.length,
        apps: admin.apps.map((app: any) => ({
          name: app.name,
          projectId: app.options?.projectId || 'unknown'
        }))
      };
    } catch (appsError) {
      result.checks.firebaseApps = {
        error: appsError instanceof Error ? appsError.message : 'Failed to check apps'
      };
    }

    console.log(`🔍 [${timestamp}] Firebase Admin SDK diagnostic completed`);
    return NextResponse.json(result);

  } catch (error) {
    console.error(`🔍 [${timestamp}] Firebase Admin SDK diagnostic error:`, error);
    return NextResponse.json({
      ...result,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}