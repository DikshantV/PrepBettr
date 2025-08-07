import { execSync } from 'child_process';

/**
 * Global Jest setup - starts Firebase emulators for testing
 */
export default async function globalSetup(): Promise<void> {
  console.log('🚀 Starting Firebase emulators for testing...');
  
  try {
    // Set environment variables for emulated Firebase
    process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
    process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
    process.env.FIREBASE_STORAGE_EMULATOR_HOST = 'localhost:9199';
    process.env.GCLOUD_PROJECT = 'test-project';
    process.env.GOOGLE_APPLICATION_CREDENTIALS = '';
    
    // Start the Firebase emulators
    console.log('Starting Firebase emulators...');
    execSync('firebase emulators:start --only firestore,auth,storage --import=./tests/fixtures/emulator-data --export-on-exit=./tests/fixtures/emulator-data &', {
      stdio: 'inherit',
      timeout: 30000
    });
    
    // Wait for emulators to be ready
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('✅ Firebase emulators started successfully');
  } catch (error) {
    console.error('❌ Failed to start Firebase emulators:', error);
    throw error;
  }
}
