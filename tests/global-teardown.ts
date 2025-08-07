import { execSync } from 'child_process';

/**
 * Global Jest teardown - stops Firebase emulators after testing
 */
export default async function globalTeardown(): Promise<void> {
  console.log('🛑 Shutting down Firebase emulators...');
  
  try {
    // Stop Firebase emulators
    execSync('firebase emulators:stop', {
      stdio: 'inherit',
      timeout: 10000
    });
    
    console.log('✅ Firebase emulators stopped successfully');
  } catch (error) {
    console.warn('⚠️  Error stopping Firebase emulators:', error);
    // Kill processes on ports as fallback
    try {
      execSync('lsof -ti:8080,9099,9199 | xargs kill -9', { stdio: 'ignore' });
    } catch (killError) {
      // Ignore if no processes to kill
    }
  }
}
