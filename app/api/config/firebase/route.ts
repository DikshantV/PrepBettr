import { NextRequest, NextResponse } from 'next/server';
import { fetchAzureSecrets } from '@/lib/azure-config';

/**
 * Firebase Configuration API Endpoint
 * 
 * Provides Firebase client configuration from Azure Key Vault
 * This is used for client-side Firebase initialization when
 * environment variables are not directly available
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔥 Fetching Firebase config from Azure Key Vault...');
    
    // Get secrets from Azure Key Vault
    const secrets = await fetchAzureSecrets();
    
    // Construct Firebase configuration
    const firebaseConfig = {
      apiKey: secrets.firebaseClientKey || process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_CLIENT_KEY || '',
      authDomain: `${secrets.firebaseProjectId || 'prepbettr'}.firebaseapp.com`,
      projectId: secrets.firebaseProjectId || process.env.FIREBASE_PROJECT_ID || 'prepbettr',
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${secrets.firebaseProjectId || 'prepbettr'}.appspot.com`,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || ''
    };
    
    // Validate required fields
    if (!firebaseConfig.projectId) {
      console.error('🔥 Firebase configuration missing: projectId is required');
      return NextResponse.json(
        { error: 'Firebase configuration incomplete: missing projectId' },
        { status: 500 }
      );
    }
    
    console.log('🔥 Firebase config provided:', {
      projectId: firebaseConfig.projectId,
      authDomain: firebaseConfig.authDomain,
      hasApiKey: !!firebaseConfig.apiKey,
      storageBucket: firebaseConfig.storageBucket
    });
    
    return NextResponse.json(firebaseConfig);
    
  } catch (error) {
    console.error('🔥 Error fetching Firebase config:', error);
    
    // Fallback to environment variables only
    const fallbackConfig = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_CLIENT_KEY || '',
      authDomain: `${process.env.FIREBASE_PROJECT_ID || 'prepbettr'}.firebaseapp.com`,
      projectId: process.env.FIREBASE_PROJECT_ID || 'prepbettr',
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${process.env.FIREBASE_PROJECT_ID || 'prepbettr'}.appspot.com`,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || ''
    };
    
    console.log('🔥 Using fallback Firebase config:', {
      projectId: fallbackConfig.projectId,
      hasApiKey: !!fallbackConfig.apiKey
    });
    
    return NextResponse.json(fallbackConfig);
  }
}
