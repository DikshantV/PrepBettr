import { NextResponse } from 'next/server';
import { initializeAzureEnvironment } from '@/lib/azure-config';

export async function GET() {
  try {
    // Initialize Azure environment to ensure secrets are loaded
    await initializeAzureEnvironment();
    
    // Get Firebase client key from environment
    const firebaseClientKey = process.env.NEXT_PUBLIC_FIREBASE_CLIENT_KEY;
    
    if (!firebaseClientKey || firebaseClientKey === 'mock-key-for-build-time') {
      return NextResponse.json({ 
        error: 'Firebase client key not available',
        hasKey: false 
      }, { status: 500 });
    }
    
    return NextResponse.json({
      apiKey: firebaseClientKey,
      authDomain: "prepbettr.firebaseapp.com",
      projectId: "prepbettr",
      storageBucket: "prepbettr.firebasestorage.app",
      messagingSenderId: "660242808945",
      appId: "1:660242808945:web:4edbaac82ed140f4d05bd0",
      measurementId: "G-LF6KN9F2HY",
      hasKey: true
    });
  } catch (error) {
    console.error('Failed to get Firebase config:', error);
    return NextResponse.json({ 
      error: 'Failed to get Firebase configuration',
      hasKey: false 
    }, { status: 500 });
  }
}
