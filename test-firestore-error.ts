"use strict";

// Mock the "use server" directive that's used in general.action.ts
(global as any).jest = { hoisted: true };

// Define TypeScript interfaces needed for testing
interface CreateFeedbackParams {
  interviewId: string;
  userId: string;
  transcript: { role: string; content: string }[];
  feedbackId?: string | undefined;
}

// Import the function directly from the source file
// Note: This bypasses the "use server" directive which is not applicable in our test environment
import { createFeedback } from './lib/actions/general.action';

// Sample data to simulate a real request
const testData = {
  interviewId: 'test-interview-id',
  userId: 'test-user-id',
  transcript: [
    { role: 'interviewer', content: 'Tell me about yourself.' },
    { role: 'candidate', content: 'I am a software engineer with 5 years of experience.' }
  ],
  feedbackId: undefined // Leave undefined to test creation of new document
};

async function runTest() {
  console.log('Testing createFeedback function...');
  try {
    const result = await createFeedback(testData);
    console.log('Result:', result);
  } catch (error) {
    console.error('Error occurred:');
    console.error(error);
    
    // Check for specific error types
    const err = error as any;
    if (err.message && err.message.includes('Missing or insufficient permissions')) {
      console.log('ERROR TYPE: FirebaseError: Missing or insufficient permissions');
    } else if (err.message && err.message.includes('UNAVAILABLE: Metadata is empty')) {
      console.log('ERROR TYPE: UNAVAILABLE: Metadata is empty');
    } else if (err.message && (err.message.includes('SSL') || err.message.includes('network'))) {
      console.log('ERROR TYPE: SSL / network plugin related message');
    }
    
    // Print stack trace
    console.error('Stack trace:', err.stack);
  }
}

runTest();
