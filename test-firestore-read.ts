"use strict";

// Mock the "use server" directive that's used in general.action.ts
(global as any).jest = { hoisted: true };

// Define TypeScript interfaces needed for testing
interface GetFeedbackByInterviewIdParams {
  interviewId: string;
  userId: string;
}

interface GetLatestInterviewsParams {
  userId?: string;
  limit?: number;
}

interface Interview {
  id: string;
  [key: string]: any;
}

interface Feedback {
  id: string;
  [key: string]: any;
}

// Import the functions directly from the source file
// Note: This bypasses the "use server" directive which is not applicable in our test environment
import { 
  getFeedbackByInterviewId
} from './lib/actions/general.action';

async function runReadTests() {
  console.log('Starting Firestore read operation tests...');
  
  // Test getFeedbackByInterviewId
  try {
    console.log('\nTesting getFeedbackByInterviewId...');
    const feedback = await getFeedbackByInterviewId({
      interviewId: 'test-interview-id',
      userId: 'test-user-id'
    });
    console.log('Result:', feedback);
  } catch (error) {
    logError('getFeedbackByInterviewId', error);
  }
}

function logError(functionName: string, error: any) {
  console.error(`Error in ${functionName}:`);
  console.error(error);
  
  // Check for specific error types
  if (error.message && error.message.includes('Missing or insufficient permissions')) {
    console.log('ERROR TYPE: FirebaseError: Missing or insufficient permissions');
  } else if (error.message && error.message.includes('UNAVAILABLE: Metadata is empty')) {
    console.log('ERROR TYPE: UNAVAILABLE: Metadata is empty');
  } else if (error.message && (error.message.includes('SSL') || error.message.includes('network'))) {
    console.log('ERROR TYPE: SSL / network plugin related message');
  }
  
  // Print stack trace
  console.error('Stack trace:', error.stack);
}

runReadTests();
